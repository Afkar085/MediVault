import httpx
from supabase import Client, create_client

from app.config import settings
from app.logger import logger

supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


class RetryDroppedConnection(httpx.HTTPTransport):
    """Try a database request once more when the connection drops under it.

    The client keeps connections open between requests. Now and then one has
    been closed at the other end, and the next request on it fails with
    "server disconnected" before Supabase ever saw it. That surfaced as a save
    that failed for no reason (and, with no CORS headers on the error, as a
    blank failure in the browser). One retry on a fresh connection fixes it.

    Only requests that are safe to send twice are retried: reads, updates and
    deletes. Inserts (POST) are not, so a row can never be added twice; a read
    through a database function (POST /rpc/...) is.
    """

    SAFE_METHODS = {"GET", "HEAD", "PATCH", "DELETE"}
    DROPPED = (httpx.RemoteProtocolError, httpx.ReadError, httpx.ConnectError)

    def _safe_to_repeat(self, request: httpx.Request) -> bool:
        return request.method in self.SAFE_METHODS or "/rpc/" in request.url.path

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        try:
            return super().handle_request(request)
        except self.DROPPED as e:
            if not self._safe_to_repeat(request):
                raise
            logger.info("Database connection dropped (%s); retrying %s once", type(e).__name__, request.method)
            return super().handle_request(request)


def _install_retry() -> None:
    try:
        session = supabase.postgrest.session
        session._transport = RetryDroppedConnection(http2=True)
    except Exception as e:  # never stop the app from starting over this
        logger.warning("Could not install the database retry: %s", e)


_install_retry()

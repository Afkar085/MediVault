# Deploying MediVault backend on Oracle Cloud (Always Free VM)

This is the "real server" path instead of Render's "connect repo, click deploy" path. More power (a free VM with up to 24GB RAM, no cold starts, no sleeping), more setup (you'll use a terminal). Budget 45-90 minutes the first time.

## Why this needs a domain name

Your frontend runs on Vercel over HTTPS. Browsers refuse to let an HTTPS page call a plain-HTTP backend (mixed content blocking) — so the backend needs real HTTPS too, which needs a domain name pointing at it. We'll use **DuckDNS**, a free dynamic DNS service — no cost, no card, 2 minutes to set up.

## Part 1 — Create the VM

1. Sign up at [oracle.com/cloud/free](https://oracle.com/cloud/free). Card required for identity verification only — the "Always Free" resources genuinely never charge unless you explicitly upgrade to a paid account later.
2. In the Oracle Cloud Console: **Compute → Instances → Create Instance**.
3. Name it `medivault-backend`.
4. **Image**: click Edit next to the image, choose **Canonical Ubuntu 22.04**.
5. **Shape**: click Edit next to the shape, choose **Ampere → VM.Standard.A1.Flex**, set **2 OCPUs / 12 GB memory** (comfortably inside the always-free 4 OCPU / 24GB pool — no need to max it out).
6. **Networking**: leave it on "Create new virtual cloud network" (Oracle sets up a public subnet for you automatically). Make sure "Assign a public IPv4 address" is checked.
7. **SSH keys**: choose "Generate a key pair for me" and **download both the private and public key files immediately** — the private key (`.key` file) is the only way you'll ever log into this VM. Save it somewhere safe, e.g. `C:\Users\Lenovo\.ssh\medivault-oracle.key`.
8. Click **Create**. Wait ~1-2 minutes for it to show "Running". Note the **Public IP Address** shown on the instance page.

## Part 2 — Open the firewall (two places, both required)

Oracle blocks traffic at the cloud level AND the VM's own OS level — missing either one means nothing works.

**Cloud level:**
1. On the instance page, click the subnet link under "Primary VNIC".
2. Click the **Default Security List**.
3. **Add Ingress Rules** twice:
   - Source CIDR `0.0.0.0/0`, IP Protocol TCP, Destination Port `80`
   - Source CIDR `0.0.0.0/0`, IP Protocol TCP, Destination Port `443`

**VM level** — do this after you SSH in, in Part 4 below.

## Part 3 — Point a free domain at your VM

1. Go to [duckdns.org](https://www.duckdns.org), sign in with GitHub or Google.
2. Under "add domain", type something like `medivault-afkar` → creates `medivault-afkar.duckdns.org`.
3. Paste your VM's **Public IP Address** into the IP field next to it, click **update ip**.
4. That's it — `medivault-afkar.duckdns.org` now points at your VM.

## Part 4 — SSH in and set up the server

Open PowerShell on your machine:

```powershell
ssh -i C:\Users\Lenovo\.ssh\medivault-oracle.key ubuntu@<YOUR_VM_PUBLIC_IP>
```

(First connection asks "are you sure you want to continue" — type `yes`.)

Now, still inside that SSH session, open the VM's own firewall:

```bash
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

Install everything the app needs:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3-pip python3-venv git

# Caddy — a web server that gets and renews HTTPS certificates automatically
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

## Part 5 — Get the app onto the VM

```bash
git clone https://github.com/Afkar085/MediVault.git
cd MediVault/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create the real `.env` file directly on the server (same values as your local one):

```bash
nano .env
```

Paste this in (Ctrl+Shift+V to paste in most terminals), filling in your real values, then **Ctrl+O, Enter, Ctrl+X** to save and exit:

```
SUPABASE_URL=https://fqjhtnginpipdpldifpy.supabase.co
SUPABASE_KEY=your_real_anon_key
JWT_SECRET=your_real_secret
JWT_EXPIRE_HOURS=24
GROQ_API_KEY=your_real_groq_key
GROQ_TEXT_MODEL=openai/gpt-oss-120b
ALLOWED_ORIGINS=https://your-frontend.vercel.app
DEBUG=false
```

## Part 6 — Make it run permanently (systemd)

This keeps the app running after you disconnect, and restarts it automatically if it crashes or the VM reboots.

```bash
sudo nano /etc/systemd/system/medivault.service
```

Paste this in (adjust nothing except confirming the paths match):

```ini
[Unit]
Description=MediVault backend
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/MediVault/backend
ExecStart=/home/ubuntu/MediVault/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

Save (Ctrl+O, Enter, Ctrl+X), then start it:

```bash
sudo systemctl enable --now medivault
sudo systemctl status medivault
```

You should see "active (running)" in green. (`sudo journalctl -u medivault -f` shows live logs if something looks wrong — Ctrl+C to stop watching.)

## Part 7 — Point Caddy at it (this is what gets you HTTPS)

```bash
sudo nano /etc/caddy/Caddyfile
```

Replace the entire contents with:

```
medivault-afkar.duckdns.org {
    reverse_proxy localhost:8000
}
```

(Use your actual DuckDNS domain from Part 3.) Save and exit, then:

```bash
sudo systemctl restart caddy
```

Caddy automatically requests and installs a real Let's Encrypt certificate for that domain the first time it starts — no manual cert commands needed.

## Part 8 — Test it

From your own computer (not the SSH session):

```
https://medivault-afkar.duckdns.org/health
```

should show `{"status":"ok"}` with a valid padlock — no cold start delay, no waking up. `/docs` should 404 (correct, disabled unless `DEBUG=true`).

## Part 9 — Point the frontend at it

Same as the Render path — tell me `https://medivault-afkar.duckdns.org` and I'll wire up `api.js` / your Vercel env var, then you redeploy on Vercel.

## Updating the app later

```bash
ssh -i C:\Users\Lenovo\.ssh\medivault-oracle.key ubuntu@<YOUR_VM_PUBLIC_IP>
cd MediVault/backend
git pull
source .venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart medivault
```

import { useEffect } from 'react';

export default function Toast({ msg, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);
  return <div className={'toast ' + (type || 'success')}>{msg}</div>;
}

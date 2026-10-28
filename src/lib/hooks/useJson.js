import { useEffect, useState } from 'react';

/**
 * 加载一个 JSON 文件。返回 { data, error, loading }。
 * @param {string | null} url 为空则不加载
 */
export default function useJson(url) {
  const [state, setState] = useState({ data: null, error: null, loading: !!url });

  useEffect(() => {
    if (!url) return undefined;
    let cancelled = false;
    setState({ data: null, error: null, loading: true });
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch((error) => !cancelled && setState({ data: null, error, loading: false }));
    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}

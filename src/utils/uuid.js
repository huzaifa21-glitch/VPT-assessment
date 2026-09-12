// A lightweight RFC-4122-ish v4 UUID generator. We don't need cryptographic
// randomness here — these ids just need to be unique enough to identify a
// record created offline before the server has ever seen it.
export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

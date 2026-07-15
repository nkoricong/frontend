// src/services/passkey.js
// このデバイスでパスキー登録済みのメールアドレス一覧をローカルに保持する。
//
// 以前は「このデバイスでパスキー登録済みかどうか」を単一のグローバルフラグ
// （ekuiki_has_passkey）で管理していたが、これだとユーザーを問わず一律に
// 判定されてしまい、共有端末で複数ユーザーを切り替えた場合や、ホーム画面の
// 「このデバイスにパスキーを登録」からの登録（この共通フラグを更新していなかった）
// で「登録済みなのに登録ボタンが表示される／未登録なのにログインボタンが
// 表示される」という不整合が起きていた。デバイス＋メールアドレスの組み合わせ
// 単位で判定できるよう、メールアドレスのリストとして保持する。

const PASSKEY_EMAILS_KEY = "ekuiki_passkey_emails";

function readEmails() {
  try {
    return JSON.parse(localStorage.getItem(PASSKEY_EMAILS_KEY)) || [];
  } catch {
    return [];
  }
}

/** このデバイスでメールアドレスがパスキー登録済みであることを記録する */
export function addPasskeyEmail(email) {
  if (!email) return;
  const normalized = email.toLowerCase();
  const emails = readEmails();
  if (!emails.includes(normalized)) {
    emails.push(normalized);
    localStorage.setItem(PASSKEY_EMAILS_KEY, JSON.stringify(emails));
  }
}

/** このデバイスでメールアドレスがパスキー登録済みかどうか */
export function hasPasskeyForEmail(email) {
  if (!email) return false;
  return readEmails().includes(email.toLowerCase());
}

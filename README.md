# IP CIDR Calculator Chrome Extension

`IPv4` と `IPv6` の prefix 情報をすばやく確認する Chrome 拡張です。`IP/prefix` をそのまま貼り付けるか、`IPv4` では `IP subnet mask` 形式でも入力できます。

## Features

- `IPv4`: `192.168.10.14/24`
- `IPv4`: `192.168.10.14 255.255.255.0`
- `IPv6`: `2001:db8::1/64`
- 入力中に自動計算
- 各結果を個別にコピー可能
- `IPv4` は `Network / Broadcast / CIDR / Subnet / Wildmask / Hosts` を表示
- `IPv6` は `Compressed / Expanded / Network` を表示

## Files

- `manifest.json`: Chrome Extension Manifest V3
- `popup.html`: 拡張ポップアップの UI
- `popup.css`: スタイル
- `popup.js`: `IPv4 / IPv6` の計算ロジック

## Load In Chrome

1. Chrome で `chrome://extensions` を開く
2. `Developer mode` を ON
3. `Load unpacked` を押す
4. このディレクトリを選ぶ

## Notes

- `IPv6` の入力は `IP/prefix` 形式のみ対応です
- `IPv6` の broadcast や subnet mask 相当は表示していません
- バックエンドや外部ライブラリは使っていません

## License

MIT

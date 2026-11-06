#!/usr/bin/env python3
"""빌드된 APK의 서명 인증서 SHA-1을 출력한다.

Google API 키의 Android 앱 제한에 넣을 지문을 구할 때 쓴다.

EAS 빌드는 APK Signature Scheme v2 전용으로 서명되어 META-INF에 .RSA
파일이 없다. 그래서 `keytool -printcert -jarfile`이 동작하지 않고,
APK Signing Block에서 인증서를 직접 꺼내야 한다.

사용법: python3 apk-sha1.py app.apk
"""
import hashlib
import struct
import sys

MAGIC = b'APK Sig Block 42'
# 앞부분 구조(signer → signed_data → certificates)가 동일한 스킴들
SCHEMES = {0x7109871a: 'v2', 0xf05368c0: 'v3'}


def length_prefixed(buf, off):
    """uint32 길이 접두 블록을 읽어 (내용, 다음 오프셋)을 돌려준다."""
    (n,) = struct.unpack_from('<I', buf, off)
    return buf[off + 4:off + 4 + n], off + 4 + n


def signing_cert(apk_bytes):
    """APK Signing Block에서 서명 인증서(DER)를 꺼낸다."""
    eocd = apk_bytes.rfind(b'PK\x05\x06')
    if eocd < 0:
        raise ValueError('ZIP EOCD를 찾을 수 없습니다 — APK가 아닌 것 같습니다.')
    (cd_off,) = struct.unpack_from('<I', apk_bytes, eocd + 16)

    # Signing Block은 central directory 바로 앞에 놓인다.
    if apk_bytes[cd_off - 16:cd_off] != MAGIC:
        raise ValueError('APK Signing Block이 없습니다 (v1 전용 서명일 수 있음).')
    (size_end,) = struct.unpack_from('<Q', apk_bytes, cd_off - 24)
    blk_start = cd_off - size_end - 8
    (size_begin,) = struct.unpack_from('<Q', apk_bytes, blk_start)
    if size_begin != size_end:
        raise ValueError('Signing Block 크기가 앞뒤로 불일치합니다.')

    # id-value 페어 순회
    pairs = {}
    p, end = blk_start + 8, cd_off - 24
    while p < end:
        (ln,) = struct.unpack_from('<Q', apk_bytes, p)
        (pair_id,) = struct.unpack_from('<I', apk_bytes, p + 8)
        pairs[pair_id] = apk_bytes[p + 12:p + 8 + ln]
        p += 8 + ln

    for sid, name in SCHEMES.items():
        if sid not in pairs:
            continue
        signers, _ = length_prefixed(pairs[sid], 0)
        signer, _ = length_prefixed(signers, 0)
        signed_data, _ = length_prefixed(signer, 0)
        _digests, off = length_prefixed(signed_data, 0)
        certs, _ = length_prefixed(signed_data, off)
        cert, _ = length_prefixed(certs, 0)  # 첫 인증서가 서명 인증서
        return cert, name

    found = ', '.join(hex(k) for k in pairs)
    raise ValueError(f'v2/v3 서명 블록이 없습니다. 발견된 ID: {found}')


def colon_hex(digest):
    h = digest.hexdigest().upper()
    return ':'.join(h[i:i + 2] for i in range(0, len(h), 2))


def main():
    if len(sys.argv) != 2:
        print(__doc__.strip().splitlines()[-1], file=sys.stderr)
        return 2
    with open(sys.argv[1], 'rb') as f:
        cert, scheme = signing_cert(f.read())
    print(f'서명 스킴 : {scheme}')
    print(f'SHA-1    : {colon_hex(hashlib.sha1(cert))}')
    print(f'SHA-256  : {colon_hex(hashlib.sha256(cert))}')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError) as e:
        print(f'오류: {e}', file=sys.stderr)
        sys.exit(1)

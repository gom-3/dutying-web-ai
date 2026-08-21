# Namecheap DNS 스냅샷 — 2026-08-21

Cloudflare 이전 전 백업 (계정 `gom3`). 이전 후 1:1 대조에 사용할 것.

## 공통

| 항목 | dutying.ai | dutying.net |
| --- | --- | --- |
| 상태 | ACTIVE | ACTIVE |
| 등록 기간 | ~ **2028-07-09** | 2023-07-12 ~ **2027-07-12** |
| **Auto-Renew** | **ON** | 🔴 **OFF** |
| Domain Privacy | ON | ON |
| Nameservers | Namecheap BasicDNS | Namecheap BasicDNS |
| DNSSEC | OFF | OFF |
| Redirect Domain | 없음 | **없음** ← `.net→.ai` 리다이렉트는 Namecheap이 아니라 **Vercel**에 있음 |
| Mail | Custom MX (Zoho) | Email Forwarding (Namecheap) |
| Parking Page | — | OFF |

Registrant/Admin/Tech/Billing 연락처 4종 모두: Beomjin Kim / Korea University / jinsim726@gmail.com (개인 명의)

## dutying.ai — Host Records (9)

| Type | Host | Value | TTL |
| --- | --- | --- | --- |
| A | @ | 216.198.79.1 | Automatic |
| A | api | 43.202.216.112 | 5 min |
| A | dev.api | 3.36.210.125 | 5 min |
| CNAME | app | e78481807e99e2ae.vercel-dns-017.com. | Automatic |
| CNAME | dev | e78481807e99e2ae.vercel-dns-017.com. | 5 min |
| CNAME | www | e78481807e99e2ae.vercel-dns-017.com. | Automatic |
| TXT | @ | zoho-verification=zb41273683.zmverify.zoho.com | Automatic |
| TXT | @ | v=spf1 include:zohomail.com ~all | Automatic |
| TXT | zmail._domainkey | v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4... | Automatic |
| TXT | _dmarc | v=DMARC1; p=none; | Automatic | ← **2026-08-21 추가** |

MX: mx.zoho.com(10) / mx2.zoho.com(20) / mx3.zoho.com(50)

**없는 것:** `docs`, `staging`

## dutying.net — Host Records (21)

| Type | Host | Value | TTL |
| --- | --- | --- | --- |
| A | @ | 216.198.79.1 | 5 min |
| A | api | 43.202.216.112 | 5 min |
| A | dev.api | 3.36.210.125 | 5 min |
| A | ml | 13.124.57.173 | 5 min |
| A | ml-alpha | 13.125.224.136 | 5 min |
| CNAME | 46pkxsq6yt45hn43iqqzdc6zpmbtcfax._domainkey | …dkim.amazonses.com. | Automatic |
| CNAME | 5sewnvbd25rrp2rbfxhpphdjfkvntrtg._domainkey | …dkim.amazonses.com. | Automatic |
| CNAME | ufqz5fpf4562nz27e2wlwv7jmov72vjv._domainkey | …dkim.amazonses.com. | Automatic |
| CNAME | admin | c2591c01faae9a4b.vercel-dns-017.com. | 5 min |
| CNAME | alpha | e78481807e99e2ae.vercel-dns-017.com. | 5 min |
| CNAME | app | e78481807e99e2ae.vercel-dns-017.com. | Automatic |
| CNAME | beta | e78481807e99e2ae.vercel-dns-017.com. | 5 min |
| CNAME | dev | e78481807e99e2ae.vercel-dns-017.com. | 5 min |
| CNAME | docs | bc7d39b1f8c6fa96.vercel-dns-017.com. | Automatic |
| CNAME | www | e78481807e99e2ae.vercel-dns-017.com. | 5 min |
| CNAME | evaluate | cname.vercel-dns.com. | 5 min |
| CNAME | test | cname.vercel-dns.com. | 5 min |
| CNAME | webview | cname.vercel-dns.com. | 5 min |
| CNAME | mxuj3yfs5kzi | gv-jcfuwewt3fzelf.dv.googlehosted.com. | 5 min |
| TXT | _dmarc | v=DMARC1; p=none; | Automatic |
| TXT | @ | v=spf1 include:spf.efwd.registrar-servers.com ~all | Automatic (Email Forwarding 잠금) |

MX: eforward1~5.registrar-servers.com (Namecheap Email Forwarding 자동 생성)

## 스냅샷에서 새로 드러난 사실

1. **`.net→.ai` 리다이렉트는 Namecheap에 없다.** "Redirect Domain: 없음" 확인. Vercel 도메인 설정에서만 해제 가능.
2. **`dutying.net` Auto-Renew OFF, 2027-07-12 만료.** 배포된 앱이 `api.dutying.net`·`webview.dutying.net`에 묶여 있고 SES 발신 도메인도 `.net`이라 만료 시 광범위 장애.
3. **트랜잭션 메일은 AWS SES @ dutying.net** (`*._domainkey` DKIM 3건). 서버의 `no-reply@dutying.net`이 이것.
4. 🔴 **`.net` SPF가 SES를 인가하지 않는다.** `v=spf1 include:spf.efwd.registrar-servers.com ~all` 에 `include:amazonses.com` 없음 → SES 발신 메일 **SPF fail** (DKIM으로만 DMARC 통과 중). `p=none`이라 지금은 안 튕기지만 정책 강화 시 즉시 문제.
5. **DMARC가 `.net`엔 있고 `.ai`엔 없다.** 새 상업 도메인 쪽이 오히려 비어 있음.
6. **Vercel 프로젝트가 최소 4개** — `e78481807e99e2ae`(app/www/dev/alpha/beta), `c2591c01faae9a4b`(admin), `bc7d39b1f8c6fa96`(docs), `cname.vercel-dns.com` 구형(webview/test/evaluate).
7. **`.ai`에 `docs` 레코드 없음** — `.net`엔 있음. docs 사이트가 `.ai`로 안 넘어옴.
8. 미정리 레코드: `alpha`, `beta`, `test`, `evaluate`, `ml-alpha` — 용도 확인 후 정리 대상.
9. DNSSEC 양쪽 다 OFF. 도메인 명의가 개인(고려대 주소) — 상업 운영 시 법인 전환 검토.


---

## 2026-08-21 적용 내역

| 대상 | 변경 | 결과 |
| --- | --- | --- |
| `dutying.ai` | TXT `_dmarc` = `v=DMARC1; p=none;` 신규 추가 | ✅ 반영 확인 (권한 NS·퍼블릭 리졸버 양쪽 `dig` 검증) |

### 의도적으로 하지 않은 것

| 항목 | 이유 |
| --- | --- |
| `dutying.net` Auto-Renew 켜기 | **"`.net`은 1년 유지 후 종료" 방침과 일치.** 만료 2027-07-12(약 11개월 후)에 자연 종료되는 게 의도된 동작 |
| `.ai` TTL 인하 | Cloudflare NS 전환 **직전 24~48h**에만 효과가 있음. 지금 내리면 몇 달간 불필요한 조회만 늘어남. 전환 일정 확정 시 실행 (T3-1) |
| `.net → .ai` 리다이렉트 제거 | **Namecheap에 존재하지 않음.** Domain 탭 "REDIRECT DOMAIN: 없음" 확인. Vercel 도메인 설정에서만 가능 |
| `docs.dutying.ai` 추가 | 어느 Vercel 프로젝트에 붙일지 미정 (T2-6) |
| `.net` SPF에 SES 추가 | Email Forwarding에 잠긴 레코드. `.net` 종료 예정이므로 **고치는 대신 SES를 `.ai`로 이전**하는 게 맞음 |

### `.net` 종료 시한에서 역산한 필수 선행 작업

`dutying.net` 만료 = **2027-07-12**. 그 전에 반드시 끝나야 하는 것:

1. **AWS SES 발신 도메인을 `dutying.ai`로 이전** — DKIM CNAME 3건 재발급 + `.ai` SPF에 `include:amazonses.com` 추가
   (현재 `.ai` SPF는 `v=spf1 include:zohomail.com ~all` 뿐이라 SES 발신 시 SPF fail)
2. 서버 발신 주소 `no-reply@dutying.net` → `.ai`
3. 배포된 앱의 `api.dutying.net` / `webview.dutying.net` 의존 제거 + 강제 업데이트 도달률 확보
4. `ml.dutying.net`, `dev.api.dutying.net`, `admin.dutying.net` 이전 또는 종료 결정

---

## ⚠️ 미사용 Route 53 호스팅 영역 (2026-08-21 발견)

AWS Route 53에 두 도메인의 퍼블릭 호스팅 영역이 존재하지만 **위임되지 않은 껍데기**다.

| | dutying.net | dutying.ai |
| --- | --- | --- |
| Hosted Zone ID | `Z02108531MKO1Q20LUIWD` | `Z0424728YVCKZS86ATF1` |
| AWS NS | ns-1264.awsdns-30.org / ns-400.awsdns-50.com / ns-724.awsdns-26.net / ns-1835.awsdns-37.co.uk | ns-743.awsdns-28.net / ns-1651.awsdns-14.co.uk / ns-1181.awsdns-19.org / ns-282.awsdns-35.com |
| **레지스트라 실제 NS** | **dns1/dns2.registrar-servers.com (Namecheap)** | **dns1/dns2.registrar-servers.com (Namecheap)** |
| 존 내용 | SOA, NS, `api` A → 43.202.216.112, `dev.api` A → 3.36.210.125 | 동일 |

권한 NS에 직접 질의해 확인 — 두 존 모두 apex A/CNAME/MX/TXT 및 그 외 서브도메인 **전무**.

### 위험

NS를 AWS로 전환하면 `.net` 21개 중 19개, `.ai` 9개+MX 전부가 소실된다.

- 모든 Vercel 사이트 다운 (apex, www, app, dev, admin, docs, webview, alpha, beta, test, evaluate)
- **수신 메일 전면 중단** (`.net` Namecheap 포워딩 MX / `.ai` Zoho MX)
- **발신 메일 DKIM 실패** (`.net` SES DKIM CNAME 3건)
- SPF / `_dmarc` / Zoho·Google 도메인 인증 소실
- `ml`, `ml-alpha` 소실

살아남는 것: `api`, `dev.api` 뿐.

**`api`/`dev.api` 값이 Namecheap과 Route 53에서 동일**하기 때문에 현재 불일치가 겉으로 드러나지 않는다. 그래서 더 위험하다.

### 조치

1. DNS 정본을 하나로 확정 (Namecheap 유지 / Route 53 / **Cloudflare** ← 현 계획)
2. Cloudflare로 간다면 Route 53 존 2개는 삭제 또는 "미사용" 태그
3. ⚠️ 삭제 전 **Terraform/CDK 등 IaC state에 물려 있는지 확인** — 코드로 생성된 존이면 콘솔 삭제 시 다음 apply에서 충돌
4. 어느 쪽이든 전환 시에는 이 문서의 전체 레코드 표로 **1:1 대조** 후 NS 변경 (T3-2)

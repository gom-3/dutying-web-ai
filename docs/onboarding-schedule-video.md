# 온보딩 근무표 설명 영상

근무표 입력 단계(3단계)에서 한국어 UI일 때만 제목 오른쪽에 설명 영상 버튼을 표시한다. 같은 페이지에 영상을 펼치며, 버튼을 누르기 전에는 영상·포스터를 요청하지 않는다. 닫기, 단계 이동, 언어 변경 시 재생을 중지하고 리소스를 해제한다.

영상 아래에서 재생 속도를 0.5×, 0.75×, 1.0×(기본), 1.25×, 1.5×, 1.75×, 2.0×로 선택할 수 있다. 배속 변경 시 영상 위치를 유지하며, 같은 단계에서 닫았다 다시 열거나 로딩 실패 후 재시도해도 선택한 속도를 유지한다. 배속은 브라우저에서 적용하므로 영상 파일과 S3 설정은 바뀌지 않는다.

## 영상과 CDN

- 원본: `병동온보딩(KR) 2.mp4`, 70,436,763 bytes, 1080p/60fps, 약 1분 53초.
- 최적화본: `ward-onboarding-ko-20260902-v1.mp4`, 6,931,296 bytes, 1080p/30fps, H.264 CRF 22, AAC 96kbps, MP4 faststart.
- 포스터: `ward-onboarding-ko-20260902-v1.webp`, 23,380 bytes, 960×540.
- 기본 CDN: `https://d2p65uxyq3mfp8.cloudfront.net`.
- 환경별 주소가 필요하면 `VITE_ONBOARDING_VIDEO_BASE_URL`에 CDN base URL을 설정한다. 경로(`/onboarding/ko/...`)는 코드가 붙인다.

현재 인프라 문서의 CloudFront OriginPath는 `/profile_img`다. 이 설정을 담당자가 확인하고, 다음 S3 prefix에 파일 2개를 업로드해야 한다.

```text
s3://dutying-ai-prod/profile_img/onboarding/ko/
```

| 파일 | Content-Type | Cache-Control |
| --- | --- | --- |
| `ward-onboarding-ko-20260902-v1.mp4` | `video/mp4` | `public, max-age=31536000, immutable` |
| `ward-onboarding-ko-20260902-v1.webp` | `image/webp` | `public, max-age=31536000, immutable` |

앱이 사용하는 URL:

```text
https://d2p65uxyq3mfp8.cloudfront.net/onboarding/ko/ward-onboarding-ko-20260902-v1.mp4
https://d2p65uxyq3mfp8.cloudfront.net/onboarding/ko/ward-onboarding-ko-20260902-v1.webp
```

기존 CloudFront가 새 객체를 읽을 수 있는지 확인한다. 정상 조회(200), 영상 Range 요청(206), 브라우저 재생을 확인한 뒤 프론트를 배포한다. 운영 S3 접근 권한이 없어 이번 작업에서는 업로드와 CDN 검증을 수행하지 않았다. 파일은 프론트 저장소 밖 `../onboarding-video-assets/`에 보관하며 앱 번들에 포함하지 않는다.

## 영어·일본어 추가

`apps/app/src/pages/onboarding-ward-create/model/tutorial-video.ts`의 `TUTORIAL_VIDEOS`에 업로드가 완료된 언어의 `src`, `poster`, `durationLabel`을 추가한다. 등록하지 않은 언어는 버튼을 숨기며 한국어 영상으로 대체하지 않는다. UI 문구는 기존 번역 카탈로그의 `page.onboardingWardCreate.video.*`를 사용한다.

영상 교체 시 파일명에 새 버전을 사용하고 주소도 변경한다. 동일 파일명 덮어쓰기로 캐시된 이전 영상이 남는 상황을 피한다.

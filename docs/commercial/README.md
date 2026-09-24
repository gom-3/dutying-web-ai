# 계정·요금제·병원 도입 고객 웹 인계

고객 화면은 `apps/app/src/pages/workspace`, API/안내/결과 검토는 `apps/app/src/features/commercial`에 있다. 기존 로그인/온보딩/관리자/게시판/신청/편성 화면에 연결했다.

서버와 함께 전달할 문서:

- [전체 인계](../../../New%20dutying-server/docs/operations-admin/README.md)
- [프론트 화면·권한·검증](../../../New%20dutying-server/docs/operations-admin/FRONTEND.md)
- [DBA 수동 반영](../../../New%20dutying-server/docs/operations-admin/DBA.md)
- [대표·운영자 준비](../../../New%20dutying-server/docs/operations-admin/USER-ACTIONS.md)
- [요건·코드·검증 연결](../../../New%20dutying-server/docs/operations-admin/REQUIREMENTS-COVERAGE.md)

통합 workspace에서 위 형제 저장소 경로가 열린다. 단독 저장소 전달 시 서버의 `docs/operations-admin` 폴더를 함께 전달한다. 운영 DB·실결제·배포는 별도 준비 후 활성화한다.

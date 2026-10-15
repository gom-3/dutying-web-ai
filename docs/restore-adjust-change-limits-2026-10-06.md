# 조절 변경량 제한 복원

조절(ADJUST)은 기존 LIGHT/NORMAL/STRONG 변경량 제한과 변경 거리 가중치를 항상 유지한다. 이전 클라이언트의 rebuild=true 또는 ADJUST의 REBUILD_UNLOCKED는 제한을 해제하지 않는다. 전체 다시 만들기는 기존 GENERATE 자동채우기를 사용한다. 웹의 조절 실행·안내를 이에 맞추고 수동 편집 보호를 복원한다. 해석 복구 및 reasonCode 변경은 유지하며 DB 변경은 없다.

검증: 기존 조절 상한, 이전 rebuild 요청 호환, 일반 자동채우기와 대화 실행 회귀. 기존 make-ai-refill-flow 문서의 ADJUST 전체 재계산 설명은 이 결정으로 대체한다.

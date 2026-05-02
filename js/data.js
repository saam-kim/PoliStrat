export const phases = ["전략회의", "외교 페이즈", "행동 입력", "결과 처리"];

const legacyPhaseNames = {
  "브리핑/전략회의": "전략회의"
};

export function displayPhaseName(phase) {
  return legacyPhaseNames[phase] || phase;
}

export const phaseDurations = {
  전략회의: 180,
  "외교 페이즈": 180,
  "행동 입력": 120,
  "결과 처리": 60
};

export const phaseDescriptions = {
  전략회의: {
    title: "전략회의",
    body: "교사가 이번 턴의 국제 정세, 이벤트, 주의사항을 안내합니다. 학생들은 자기 국가의 자원과 주변 정세를 확인하고 이번 턴 목표를 정합니다.",
    keywords: "학생 활동: 상황 파악 · 자원 확인 · 목표 설정 · 위험 검토"
  },
  "외교 페이즈": {
    title: "외교 페이즈",
    body: "다른 모둠과 협상합니다. 협정 제안은 별도로 보낼 수 있고, 행동 카드에서 외교 행동을 제출하면 그 행동이 이번 턴 최종 행동이 됩니다.",
    keywords: "학생 활동: 협상 · 제안 · 조건 조율 · 최종 행동 선택"
  },
  "행동 입력": {
    title: "행동 입력",
    body: "모둠이 최종 행동을 선택해 태블릿에 제출합니다. 영토 점령은 지도 타일 선택이 필요하고, 다른 행동은 타일 없이 제출할 수 있습니다.",
    keywords: "학생 활동: 최종 결정 · 행동 선택 · 제출"
  },
  "결과 처리": {
    title: "결과 처리",
    body: "교사가 제출을 마감하고 결과를 확인합니다. 학생들은 자신의 선택이 국가 자원, 영토, 관계에 어떤 영향을 주었는지 관찰합니다.",
    keywords: "학생 활동: 결과 확인 · 전략 수정 · 다음 턴 준비"
  }
};

export const teacherChecklist = {
  전략회의: ["이번 턴 이벤트를 선택하거나 공지합니다.", "학생들이 현재 자원과 순위를 확인하게 합니다.", "각 모둠이 이번 턴 목표와 위험 요소를 하나로 정하게 합니다."],
  "외교 페이즈": ["학생들이 협정 제안을 보내도록 안내합니다.", "외교 행동 카드 제출은 이번 턴 최종 행동이라는 점을 안내합니다.", "협정 현황에서 제안을 승인하거나 거절합니다."],
  "행동 입력": ["제출 현황을 보며 미제출 모둠을 확인합니다.", "제출 마감 전 마지막 30초를 공지합니다.", "제출 마감 후 결과 처리로 이동합니다."],
  "결과 처리": ["결과 처리 버튼을 눌러 행동과 이벤트를 반영합니다.", "턴 요약과 순위 변화를 함께 읽습니다.", "처리 완료 후 다음 페이즈로 이동합니다."]
};

export const maxTurns = 5;

export const resourceLabels = {
  budget: "예산",
  military: "군사력",
  diplomacy: "외교",
  gdp: "GDP",
  support: "지지율",
  food: "식량",
  energy: "에너지",
  strategicPoints: "핵심",
  conqueredTiles: "점령",
  defensePosture: "방어"
};

export const eventDefinitions = [
  {
    id: "energy_crisis",
    title: "에너지 위기 발생",
    body: "국제 에너지 가격이 급등했습니다. 에너지 자립도가 낮은 국가는 다음 전략을 더 신중히 잡아야 합니다.",
    effects: { energy: -6, budget: -3 }
  },
  {
    id: "food_shock",
    title: "식량 가격 급등",
    body: "곡물 가격이 올라 국내 물가와 지지율에 압박이 생겼습니다.",
    effects: { food: -6, support: -2 }
  },
  {
    id: "border_tension",
    title: "국경 분쟁 격화",
    body: "분쟁 지역 긴장이 높아졌습니다. 방어 태세가 없는 국가는 군사 부담이 커집니다.",
    effects: { military: -4, support: -1 }
  },
  {
    id: "sanctions_debate",
    title: "국제 제재 논의",
    body: "국제 여론전이 치열해졌습니다. 외교 자원이 약한 국가는 영향력 손실을 겪습니다.",
    effects: { diplomacy: -4, gdp: -3 }
  },
  {
    id: "refugee_crisis",
    title: "난민 위기 발생",
    body: "인도주의 대응이 필요한 상황입니다. 국내 자원과 지지율이 흔들립니다.",
    effects: { budget: -4, support: -2, diplomacy: 2 }
  }
];

export const diplomacyTypes = {
  alliance: {
    label: "동맹 선언",
    desc: "두 국가가 안보 협력과 상호 신뢰를 강화합니다.",
    proposerEffects: { diplomacy: 3, support: 1 },
    partnerEffects: { diplomacy: 3, support: 1 }
  },
  trade: {
    label: "무역 협정",
    desc: "양국이 경제 협력을 확대해 성장 기반을 강화합니다.",
    proposerEffects: { gdp: 4, budget: 3 },
    partnerEffects: { gdp: 4, budget: 3 }
  },
  energy: {
    label: "에너지 협정",
    desc: "에너지 공급과 외교적 신뢰를 교환합니다.",
    proposerEffects: { energy: 8, diplomacy: 1 },
    partnerEffects: { budget: 3, diplomacy: 2 }
  },
  mediation: {
    label: "분쟁 중재",
    desc: "국제 갈등을 낮추고 중재국 이미지를 확보합니다.",
    proposerEffects: { diplomacy: 4, strategicPoints: 1 },
    partnerEffects: { support: 2, diplomacy: 2 }
  },
  sanctions: {
    label: "공동 제재",
    desc: "양국이 공동 노선을 발표해 국제 여론전을 주도합니다.",
    proposerEffects: { diplomacy: -2, strategicPoints: 2, support: 1 },
    partnerEffects: { diplomacy: -2, strategicPoints: 2, support: 1 }
  }
};

export const actionDefinitions = [
  {
    id: "conquer_tile",
    name: "영토 점령",
    icon: "🗡️",
    phase: "행동 입력",
    requiresTile: true,
    tileOwnership: true,
    summary: "일반 지역 -20 / ★핵심 지역 -30 · 타일 선택 필요",
    costLabel: "-20~-30",
    costSmall: "군사력",
    costs: { military: 20 },
    strategicCosts: { military: 30 },
    effects: { conqueredTiles: 1 },
    strategicEffects: { strategicPoints: 3 },
    successText: {
      normal: "일반 지역 점령 시도: 군사력 -20, 점령 +1",
      strategic: "★ 핵심 지역 점령 시도: 군사력 -30, 점령 +1, 핵심 +3"
    }
  },
  {
    id: "raise_military",
    name: "군비 증강",
    icon: "🛡️",
    phase: "행동 입력",
    summary: "예산을 투입해 군사력을 빠르게 강화",
    costLabel: "-10 / +8",
    costSmall: "예산·군사력",
    costs: { budget: 10 },
    effects: { military: 8 },
    successText: "예산 -10, 군사력 +8"
  },
  {
    id: "defensive_posture",
    name: "방어 태세",
    icon: "🧱",
    phase: "행동 입력",
    summary: "방어 준비를 높이고 국내 불안을 낮춤",
    costLabel: "-8 / +방어",
    costSmall: "예산",
    costs: { budget: 8 },
    effects: { military: 4, support: 2, defensePosture: 1 },
    successText: "예산 -8, 군사력 +4, 지지율 +2, 방어 태세 +1"
  },
  {
    id: "industrial_investment",
    name: "산업 투자",
    icon: "🏭",
    phase: "행동 입력",
    summary: "단기 예산을 써서 GDP 기반을 확장",
    costLabel: "-12 / +12",
    costSmall: "예산·GDP",
    costs: { budget: 12 },
    effects: { gdp: 12, support: -1 },
    successText: "예산 -12, GDP +12, 지지율 -1"
  },
  {
    id: "secure_food",
    name: "식량 확보",
    icon: "🌾",
    phase: "행동 입력",
    summary: "식량 위기와 국내 불만을 완화",
    costLabel: "-8 / +12",
    costSmall: "예산·식량",
    costs: { budget: 8 },
    effects: { food: 12, support: 1 },
    successText: "예산 -8, 식량 +12, 지지율 +1"
  },
  {
    id: "energy_development",
    name: "에너지 개발",
    icon: "🔋",
    phase: "행동 입력",
    summary: "에너지 자립도를 올리고 산업 기반을 보강",
    costLabel: "-10 / +10",
    costSmall: "예산·에너지",
    costs: { budget: 10 },
    effects: { energy: 10, gdp: 3, support: -1 },
    successText: "예산 -10, 에너지 +10, GDP +3, 지지율 -1"
  },
  {
    id: "energy_import_deal",
    name: "에너지 수입 협정",
    icon: "⚡",
    phase: "외교 페이즈",
    summary: "외교 포인트를 써서 에너지 위기에 대응",
    costLabel: "-8 / +12",
    costSmall: "외교·에너지",
    costs: { diplomacy: 8 },
    effects: { energy: 12 },
    successText: "외교 포인트 -8, 에너지 +12"
  },
  {
    id: "summit",
    name: "정상회담",
    icon: "🤝",
    phase: "외교 페이즈",
    summary: "외교적 신뢰와 국내 지지율을 확보",
    costLabel: "-5 / +6",
    costSmall: "외교",
    costs: { diplomacy: 5 },
    effects: { diplomacy: 6, support: 3 },
    successText: "외교 포인트 -5, 외교 영향력 +6, 지지율 +3"
  },
  {
    id: "trade_agreement",
    name: "무역 협정",
    icon: "🚢",
    phase: "외교 페이즈",
    summary: "외교력을 경제 성과로 전환",
    costLabel: "-6 / +GDP",
    costSmall: "외교",
    costs: { diplomacy: 6 },
    effects: { gdp: 8, budget: 4, support: 1 },
    successText: "외교 포인트 -6, GDP +8, 예산 +4, 지지율 +1"
  },
  {
    id: "joint_sanctions",
    name: "공동 제재",
    icon: "⛔",
    phase: "외교 페이즈",
    summary: "국제 여론을 주도해 전략 점수를 확보",
    costLabel: "-10 / +2",
    costSmall: "외교·핵심",
    costs: { diplomacy: 10 },
    effects: { strategicPoints: 2, support: 2 },
    successText: "외교 포인트 -10, 핵심 점수 +2, 지지율 +2"
  },
  {
    id: "humanitarian_aid",
    name: "인도적 지원",
    icon: "🕊️",
    phase: "외교 페이즈",
    summary: "예산을 투입해 국제 이미지와 국내 결속 강화",
    costLabel: "-8 / +외교",
    costSmall: "예산",
    costs: { budget: 8 },
    effects: { diplomacy: 4, support: 6 },
    successText: "예산 -8, 외교 포인트 +4, 지지율 +6"
  }
];

export const layout = [
  ["empty", "empty", "a", "a", "a", "empty", "neutral", "neutral", "b", "b", "empty", "empty", "empty", "empty"],
  ["empty", "a", "a", "a", "dispute", "b", "b", "b", "neutral", "empty", "c", "c", "empty", "empty"],
  ["neutral", "a", "neutral", "neutral", "d", "d", "d", "empty", "neutral", "c", "c", "empty", "empty", "empty"],
  ["empty", "empty", "d", "d", "d", "neutral", "neutral", "neutral", "c", "c", "e", "e", "empty", "empty"],
  ["empty", "neutral", "f", "f", "f", "neutral", "empty", "empty", "empty", "e", "e", "empty", "empty", "empty"],
  ["empty", "f", "f", "empty", "neutral", "empty", "empty", "empty", "empty", "empty", "empty", "empty", "empty", "empty"]
];

export const studentLayout = [
  ["empty", "a", "a", "a", "empty", "b", "b", "empty", "c"],
  ["a", "a", "dispute", "b", "b", "neutral", "c", "c", "empty"],
  ["empty", "neutral", "neutral", "d", "d", "neutral", "c", "empty", "empty"],
  ["neutral", "d", "d", "d", "neutral", "e", "e", "empty", "empty"],
  ["empty", "f", "f", "f", "neutral", "empty", "empty", "empty", "empty"]
];

export const baseLayouts = {
  2: [
    ["empty", "empty", "a", "a", "a", "neutral", "neutral", "b", "b", "empty", "empty", "empty"],
    ["empty", "a", "a", "a", "dispute", "neutral", "neutral", "b", "b", "b", "empty", "empty"],
    ["neutral", "a", "neutral", "neutral", "neutral", "neutral", "neutral", "neutral", "b", "empty", "empty", "empty"],
    ["neutral", "neutral", "neutral", "neutral", "neutral", "neutral", "neutral", "neutral", "neutral", "neutral", "empty", "empty"],
    ["empty", "neutral", "neutral", "neutral", "neutral", "neutral", "neutral", "neutral", "neutral", "empty", "empty", "empty"],
    ["empty", "empty", "neutral", "neutral", "neutral", "neutral", "neutral", "neutral", "empty", "empty", "empty", "empty"],
    ["empty", "empty", "empty", "neutral", "neutral", "neutral", "neutral", "empty", "empty", "empty", "empty", "empty"]
  ],
  3: [
    ["empty", "empty", "a", "a", "a", "neutral", "neutral", "b", "b", "empty", "empty", "empty"],
    ["empty", "a", "a", "a", "dispute", "neutral", "neutral", "b", "b", "b", "empty", "empty"],
    ["neutral", "a", "neutral", "neutral", "neutral", "c", "c", "c", "neutral", "b", "empty", "empty"],
    ["neutral", "neutral", "neutral", "neutral", "neutral", "c", "c", "c", "neutral", "neutral", "empty", "empty"],
    ["empty", "neutral", "neutral", "neutral", "neutral", "neutral", "neutral", "neutral", "neutral", "empty", "empty", "empty"],
    ["empty", "empty", "neutral", "neutral", "neutral", "neutral", "neutral", "neutral", "empty", "empty", "empty", "empty"],
    ["empty", "empty", "empty", "neutral", "neutral", "neutral", "neutral", "empty", "empty", "empty", "empty", "empty"]
  ],
  4: [
    ["empty", "empty", "a", "a", "a", "neutral", "neutral", "b", "b", "empty", "empty", "empty"],
    ["empty", "a", "a", "a", "dispute", "neutral", "neutral", "b", "b", "b", "empty", "empty"],
    ["neutral", "a", "neutral", "neutral", "neutral", "neutral", "neutral", "neutral", "b", "neutral", "empty", "empty"],
    ["neutral", "neutral", "neutral", "neutral", "neutral", "neutral", "neutral", "neutral", "neutral", "neutral", "empty", "empty"],
    ["empty", "c", "c", "c", "neutral", "neutral", "neutral", "d", "d", "d", "empty", "empty"],
    ["empty", "c", "c", "neutral", "neutral", "neutral", "neutral", "neutral", "d", "d", "empty", "empty"],
    ["empty", "empty", "c", "neutral", "neutral", "neutral", "neutral", "d", "empty", "empty", "empty", "empty"]
  ],
  5: [
    ["empty", "empty", "a", "a", "a", "neutral", "neutral", "b", "b", "empty", "empty", "empty"],
    ["empty", "a", "a", "a", "dispute", "neutral", "neutral", "b", "b", "b", "empty", "empty"],
    ["neutral", "a", "neutral", "neutral", "neutral", "e", "e", "e", "b", "neutral", "empty", "empty"],
    ["neutral", "neutral", "neutral", "neutral", "neutral", "e", "e", "e", "neutral", "neutral", "empty", "empty"],
    ["empty", "c", "c", "c", "neutral", "neutral", "neutral", "d", "d", "d", "empty", "empty"],
    ["empty", "c", "c", "neutral", "neutral", "neutral", "neutral", "neutral", "d", "d", "empty", "empty"],
    ["empty", "empty", "c", "neutral", "neutral", "neutral", "neutral", "d", "empty", "empty", "empty", "empty"]
  ],
  6: [
    ["empty", "empty", "a", "a", "a", "neutral", "neutral", "b", "b", "empty", "empty", "empty"],
    ["empty", "a", "a", "a", "dispute", "neutral", "neutral", "b", "b", "b", "empty", "empty"],
    ["f", "a", "neutral", "neutral", "neutral", "e", "e", "e", "b", "neutral", "empty", "empty"],
    ["f", "f", "neutral", "neutral", "neutral", "e", "e", "e", "neutral", "neutral", "d", "empty"],
    ["empty", "c", "c", "c", "neutral", "neutral", "neutral", "d", "d", "d", "d", "empty"],
    ["empty", "c", "c", "neutral", "neutral", "neutral", "neutral", "neutral", "d", "d", "empty", "empty"],
    ["empty", "empty", "c", "neutral", "neutral", "neutral", "neutral", "d", "empty", "empty", "empty", "empty"]
  ]
};

export const strategicTileIndexes = [3, 13, 22, 34, 46];

export const tileNames = {
  empty: "해역/미개척 지역",
  neutral: "중립 지역",
  dispute: "분쟁 지역",
  a: "A국 영토",
  b: "B국 영토",
  c: "C국 영토",
  d: "D국 영토",
  e: "E국 영토",
  f: "F국 영토"
};

export const countryTypes = {
  power: {
    label: "강대국",
    desc: "군사·경제 균형형",
    tip: "초반에는 군사력 우위를 바탕으로 억제력을 확보하되, 지나친 확장은 다른 국가의 견제를 부를 수 있습니다.",
    gdp: 130,
    budget: 45,
    military: 70,
    diplomacy: 30,
    support: 60,
    food: 65,
    energy: 55
  },
  emerging: {
    label: "신흥국",
    desc: "성장 잠재력형",
    tip: "초반에는 무리한 충돌보다 경제 성장과 협정을 통해 후반 역전을 노리는 전략이 유리합니다.",
    gdp: 105,
    budget: 38,
    military: 45,
    diplomacy: 32,
    support: 68,
    food: 70,
    energy: 50
  },
  resource: {
    label: "자원국",
    desc: "에너지 우위형",
    tip: "에너지를 무기로 협상력을 높일 수 있습니다. 에너지 위기 이벤트 때 핵심 국가가 됩니다.",
    gdp: 110,
    budget: 40,
    military: 45,
    diplomacy: 28,
    support: 62,
    food: 65,
    energy: 95
  },
  trade: {
    label: "무역국",
    desc: "외교·무역 특화형",
    tip: "동맹과 무역 협정을 적극적으로 활용하세요. 직접 충돌보다 네트워크 구축이 강점입니다.",
    gdp: 115,
    budget: 42,
    military: 38,
    diplomacy: 55,
    support: 64,
    food: 60,
    energy: 45
  },
  island: {
    label: "도서국",
    desc: "방어 특화형",
    tip: "방어와 생존력이 강점입니다. 중립을 유지하거나 전략적 동맹을 맺어 장기전을 준비하세요.",
    gdp: 100,
    budget: 36,
    military: 42,
    diplomacy: 38,
    support: 66,
    food: 75,
    energy: 40
  },
  developing: {
    label: "개도국",
    desc: "잠재력·변수형",
    tip: "초기 자원은 부족하지만 협력과 기회 선택에 따라 크게 성장할 수 있습니다.",
    gdp: 85,
    budget: 32,
    military: 35,
    diplomacy: 35,
    support: 72,
    food: 62,
    energy: 45
  }
};

---
title: 스탯 시스템 리팩토링
date: 2025-07-16 10:45:00 +0900
categories: [프로젝트, Eternal-Survival]
tags: [게임개발, Unity, Eternal Return]
---

안녕하세요, 지난번에 이은 Eternal Survival 개발 노트입니다.

오늘은 프로젝트의 심장부와도 같은 '스탯(Stat) 시스템'에 적용한 중요한 아키텍처 개선에 대해 이야기하고자 합니다.

### 기존 방식의 문제점: "덧셈과 곱셈의 함정"

프로젝트 원형이 되었던 'Undead Survivor'에셋에서, 플레이어의 이동 속도나 무기의 공격력 같은 스탯은 단순한 `float` 변수였습니다.
특히 다른 아이템의 영향을 받아 무기의 스탯이 변경되는 경우 오브젝트가 가지고 있던 변수의 값을 직접 접근하여 변경하는 방식을 사용하고 있었습니다.

{% highlight c# %}
// Player.cs
public float speed = 5.0f;

// Weapon.cs
public float damage = 10.0f;
void ApplyGear(float rate)
{
damage \*= 1+rate;
}
{% end highlight %}

이 방식은 간단하고 직관적입니다. 하지만 "이동 속도 10% 증가 신발"이나 "15초간 공격력 20% 증가 물약" 같은 아이템과 스킬이 추가되는 순간, 상황은 복잡해집니다.

{% highlight c# %}
// 아이템과 버프가 추가될수록 코드는 점점 복잡해진다.
float finalSpeed = player.baseSpeed _ shoe.speedModifier _ speedBuff.modifier;

// 만약 버프가 중첩된다면?
// 만약 특정 아이템을 장착 해제한다면?
// 만약 버프의 지속시간이 끝난다면?
{% end highlight %}

이러한 연산은 매번 스탯이 변경될 때마다 모든 요소를 다시 계산해야 하며, 다음과 같은 명확한 한계에 부딪혔습니다.

1.  **추적의 어려움:** "대체 지금 내 공격력이 왜 17.5이지?"라는 질문에 답하기 위해, 공격력에 영향을 주는 모든 코드(아이템, 스킬, 버프)를 일일이 찾아다녀야 했습니다.
2.  **높은 결합도:** 아이템 스크립트가 플레이어의 `speed` 변수를 직접 참조하고, 버프 스크립트가 무기의 `damage` 변수를 직접 알아야 했습니다. 이는 스파게티 코드의 전형적인 원인이 됩니다.
3.  **확장성의 부재:** "공격력 합연산 후 곱연산" 같은 복잡한 계산 규칙을 추가하거나, "가장 높은 공격력 버프 하나만 적용" 같은 로직을 구현하기가 매우 까다로웠습니다.

### 해결책: `ModifiableStat` 시스템의 도입

이 문제를 해결하기 위해, 저는 단순한 숫자 변수를 넘어선 **'수정 가능한 스탯'이라는 개념의 `ModifiableStat` 클래스**를 설계하고 도입했습니다.

이 시스템의 핵심 아이디어는, 하나의 스탯을 **'기본값(Base Value)'**과 그 값을 변경하는 **'수정자 목록(List of Modifiers)'**으로 분리하여 관리하는 것입니다.

{% highlight c# %}
// 개념적인 코드 구조
public class StatModifier
{
public readonly float Value; // 수정 값 (e.g., 1.1f for +10%)
public readonly ModifierType Type; // 합연산, 곱연산 등
public readonly object Source; // 이 수정을 가한 주체 (e.g., 신발 아이템)
}

public class ModifiableStat
{
private float baseValue;
private readonly List<StatModifier> modifiers = new List<StatModifier>();

    // 최종 계산된 값을 반환하는 프로퍼티
    public float Value { get { /* 모든 modifier를 적용하여 계산 */ } }

    public void AddModifier(StatModifier mod) { ... }
    public void RemoveAllModifiersFromSource(object source) { ... }

}
{% end highlight %}

이제 플레이어의 `speed`는 더 이상 `float`이 아닌 `ModifiableStat` 객체가 됩니다.

### `ModifiableStat`이 가져온 구조적 개선

1.  **명확성과 디버깅 용이성:**
    이제 특정 스탯의 최종값이 어떻게 계산되었는지 한눈에 파악할 수 있습니다. `speed.modifiers` 리스트를 확인하기만 하면, 어떤 아이템과 버프가 어떤 순서로, 어떤 값으로 영향을 미치고 있는지 명확하게 추적할 수 있습니다.

2.  **유지보수성과 확장성:**
    새로운 아이템을 추가하는 작업은 더 이상 `Player`나 `Weapon` 스크립트를 수정하는 것이 아닙니다. 그저 `ModifiableStat`에 새로운 `StatModifier`를 하나 추가(`AddModifier`)하는 것으로 끝납니다. 아이템을 장착 해제할 때는 해당 아이템을 `Source`로 가지는 모든 수정자를 제거(`RemoveAllModifiersFromSource`)하면 됩니다.

3.  **결합도 감소 (Decoupling):**
    아이템은 더 이상 플레이어의 특정 변수를 알 필요가 없습니다. 그저 "나는 '이동 속도' 스탯에 1.1배의 곱연산 수정자를 제공하는 존재야"라는 정보만 가지고 있으면 됩니다. 이는 컴포넌트 간의 의존성을 크게 낮춰, 훨씬 유연하고 독립적인 시스템을 구축하게 해줍니다.

### 결론

`ModifiableStat` 시스템의 도입을 통해 복잡하게 얽힐 수 있었던 스탯 관련 로직을 예측 가능하고 관리하기 쉬운 구조로 정립함으로써, 이제는 더 복잡하고 재미있는 아이템과 스킬들을 추가할 수 있는 견고한 토대를 마련했습니다.
이를 적절하게 활용하여 앞으로 다양한 아이템들을 쉽게 추가할 수 있을 것으로 기대하고 있습니다.

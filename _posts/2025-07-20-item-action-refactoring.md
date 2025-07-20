---
title: "Unity 아이템 시스템 리팩토링"
date: 2025-07-20 12:00:00 +0900
categories: [프로젝트, Eternal-Survival]
tags: [게임개발, Unity, Eternal Return]
---

안녕하세요. 오늘은 지난번 무기 시스템 개선에 이어서 진행한 아이템 시스템 전체에 반영된 개선 사항이 있어서 공유하고자 합니다.

## 'Weapon.cs'만 문제가 아니었잖아?

골드메탈님의 'Undead Survivor' 에셋에서는 아이템의 종류가 많지 않았기 때문에, `Item.cs` 스크립트 내에서 `switch` 문을 사용하여 아이템 타입(`ItemType.Melee`, `ItemType.Glove` 등)에 따라 다른 로직을 수행하는 것이 효율적이었습니다. 예를 들어, 무기 아이템은 `Weapon` 컴포넌트를 생성하고 'Weapon.cs가 관리, 장비 아이템은 `Gear` 컴포넌트를 생성하고 'Gear.cs'가 관리하는 식이었죠. 그런데 'Weapon.cs'의 문제를 해결하면서, 이 구조가 다른 아이템 타입에도 동일하게 적용되어 있다는 것을 깨달았습니다.

- **`Item.cs`의 문제점:** 새로운 아이템 타입이 추가될 때마다 `OnClick()` 메서드와 `OnEnable()` (UI 설명 업데이트) 메서드 내의 `switch` 문이 계속 길어졌습니다. 이는 `Item.cs`가 너무 많은 책임을 지게 만들었습니다.
- **`Gear.cs`의 문제점:** 장비 아이템의 효과를 담당하는 `Gear.cs` 역시 `switch (itemData.itemType)` 문으로 장갑(`Glove`)과 신발(`Shoe`)의 효과를 분기 처리하고 있었습니다. 또한, 장비의 '행동'이 코드에 하드코딩되어 있어, 새로운 효과를 가진 장비를 만들려면 코드를 직접 수정해야만 했습니다.

## 해결책: 전략 패턴(Strategy Pattern)

저희는 이 문제를 해결하기 위해 **전략 패턴(Strategy Pattern)**을 도입하고, 이를 Unity의 **ScriptableObject**와 결합하는 방식을 선택했습니다.

전략 패턴은 객체들이 할 수 있는 행위들(여기서는 아이템의 '행동')을 캡슐화하여 클라이언트(여기서는 `Item.cs`)로부터 분리하고, 행위를 직접 수정하지 않고 전략을 교체하는 것으로 객체의 동작을 동적으로 수정할 수 있도록 하는 디자인 패턴입니다. 여기에 ScriptableObject를 활용하면, 각 '전략' 자체를 에셋 파일로 만들어 코드 수정 없이 에디터에서 아이템의 행동을 정의하고 연결할 수 있게 됩니다.

### 1. `ItemAction.cs` - 아이템 행동의 추상 인터페이스

가장 먼저, 모든 아이템 행동의 공통적인 '계약'을 정의하는 추상 클래스 `ItemAction`을 만들었습니다.

{% highlight c# %}
// Assets/Undead Survivor/Script/ItemAction.cs
using UnityEngine;

public abstract class ItemAction : ScriptableObject
{
public abstract void OnEquip(Item item);
public abstract void OnLevelUp(Item item);
public abstract void OnUpdate(Item item);
public virtual string GetDescription(Item item) { /_ ... _/ }
}
{% endhighlight %}

이 클래스는 아이템이 장착될 때(`OnEquip`), 레벨업할 때(`OnLevelUp`), 매 프레임 업데이트될 때(`OnUpdate`), 그리고 UI에 설명을 표시할 때(`GetDescription`) 어떤 동작을 해야 하는지를 정의합니다. 각 구체적인 아이템 행동은 이 `ItemAction`을 상속받아 자신만의 로직을 구현하게 됩니다.

### 2. `Action_Weapon.cs` - 무기 아이템의 행동 정의

무기 아이템의 행동을 담당하는 `Action_Weapon` 클래스입니다. 이 클래스의 핵심은 `TypeDropdown` 어트리뷰트와 `SerializableSystemType`을 활용하여, 에디터에서 `WeaponBase`를 상속받는 어떤 무기 컴포넌트(`Weapon`, `QuakeWeapon` 등)라도 동적으로 연결할 수 있게 한 것입니다.

{ % highlight c# %}
// Assets/Undead Survivor/Script/Action_Weapon.cs
using UnityEngine;

[CreateAssetMenu(fileName = "Action_Weapon", menuName = "Item Actions/Generic Weapon")]
public class Action_Weapon : ItemAction
{
[TypeDropdown(typeof(WeaponBase))]
public SerializableSystemType weaponType; // 에디터에서 Weapon 또는 QuakeWeapon 선택

    public override void OnEquip(Item item)
    {
        // 선택된 weaponType에 해당하는 컴포넌트를 동적으로 추가하고 초기화
        GameObject newWeapon = new GameObject();
        item.weapon = newWeapon.AddComponent(weaponType.Type) as WeaponBase;
        item.weapon?.Init(item.data);
    }

    public override void OnLevelUp(Item item)
    {
        item.weapon?.LevelUp();
    }

    public override string GetDescription(Item item)
    {
        // 레벨별 스탯 증가량을 동적으로 계산하여 설명 생성
        // ... (생략: 복잡한 스탯 계산 로직)
    }

}
{% endhighlight %}

이제 새로운 무기 타입이 추가되더라도 `Action_Weapon.cs`를 수정할 필요 없이, `ItemData` 에셋에서 `Action_Weapon`을 연결하고 `weaponType`만 지정해주면 됩니다.

### 3. `Action_StatBoostGear.cs` - 능력치 강화 장비의 행동 정의

기존 `Gear.cs`의 역할을 대체하는 `Action_StatBoostGear` 클래스입니다. 이 클래스는 어떤 대상(`Player` 또는 `Weapon`)의 어떤 스탯에 어떤 타입의 `StatModifier`를 적용할지를 데이터(`statValues`, `modifierType`)로 정의합니다.

{% highlight c# %}
// Assets/Undead Survivor/Script/Action_StatBoostGear.cs
using UnityEngine;

[CreateAssetMenu(fileName = "Action_StatBoostGear", menuName = "Item Actions/Stat Boost Gear")]
public class Action_StatBoostGear : ItemAction
{
public enum Target { Player, Weapon }
public Target targetType;
public float[] statValues; // 레벨별 적용 값
public StatModifierType modifierType; // Flat, Additive, Multiplicative

    public override void OnEquip(Item item)
    {
        ApplyStat(item, 0);
    }

    public override void OnLevelUp(Item item)
    {
        RemoveStat(item, item.level - 1); // 이전 효과 제거
        ApplyStat(item, item.level);      // 새 효과 적용
    }

    private void ApplyStat(Item item, int level)
    {
        float value = (statValues.Length > level) ? statValues[level] : statValues[0];
        StatModifier modifier = new StatModifier(value, modifierType, this); // Source를 this로 설정

        switch (targetType)
        {
            case Target.Player:
                GameManager.instance.player.speed.AddModifier(modifier);
                break;
            case Target.Weapon:
                // ... 무기 스탯 적용 로직
                break;
        }
    }

    private void RemoveStat(Item item, int level)
    {
        // Source를 기준으로 쉽게 모디파이어 제거
        switch (targetType)
        {
            case Target.Player:
                GameManager.instance.player.speed.RemoveAllModifiersFromSource(this);
                break;
            case Target.Weapon:
                // ... 무기 스탯 제거 로직
                break;
        }
    }

    public override string GetDescription(Item item)
    {
        // 레벨별 스탯 증가량을 동적으로 계산하여 설명 생성
        // ... (생략: 복잡한 스탯 계산 로직)
    }

}
{% endhighlight %}

이로써 `Gear.cs`는 더 이상 필요 없게 되었고, 새로운 장비 효과는 `Action_StatBoostGear` 에셋을 만들고 값만 설정해주면 됩니다. `StatModifier`의 `Source`를 `this` (ScriptableObject 인스턴스)로 설정하여, 해당 장비가 비활성화되거나 레벨업할 때 이 장비가 적용했던 모든 모디파이어를 쉽게 제거할 수 있게 한 것이 핵심입니다.

### 4. `Item.cs`의 변화: 행동 위임

가장 큰 변화는 `Item.cs`가 더 이상 아이템의 구체적인 행동을 직접 처리하지 않고, `ItemData`에 연결된 `ItemAction` ScriptableObject에게 책임을 위임한다는 점입니다.

{% highlight c# %}
// Assets/Undead Survivor/Script/Item.cs (핵심 변경 부분)

public ItemAction itemAction; // ItemData에 연결된 ItemAction 참조

// OnClick() 메서드 내에서
public void OnClick()
{
// 아이템 타입에 따른 복잡한 switch 문 대신, 연결된 ItemAction에게 행동 위임
itemAction?.OnEquip(this); // 또는 OnLevelUp(this) 등
level++;
// ...
}

// OnEnable() 메서드 내에서
void OnEnable()
{
// UI 설명도 ItemAction에게 위임
textDesc.text = itemAction?.GetDescription(this);
// ...
}
{% endhighlight %}

이제 `Item.cs`는 아이템의 '데이터'와 '행동'을 연결하는 단순한 브릿지 역할만 수행하게 됩니다. 이는 **단일 책임 원칙**을 준수하는 설계입니다.

## 리팩토링의 결과와 얻은 이점

이번 리팩토링을 통해 'Weapon.cs'를 개선했을 때와 마찬가지로 다음과 같은 중요한 이점들을 얻을 수 있을 것으로 기대됩니다.

1.  **코드 중복 제거:** `WeaponBase`와 `ItemAction` 추상 클래스를 통해 공통 로직을 재사용하고, 각 구체 클래스는 자신만의 고유한 로직에 집중할 수 있게 되었습니다.
2.  **유지보수성 향상:** 각 클래스가 자신의 명확한 책임만 가지게 되어 코드를 이해하고 수정하기가 훨씬 쉬워졌습니다.
3.  **뛰어난 확장성:** 앞새로운 무기나 장비 효과를 추가할 때, 기존 코드를 수정할 필요 없이 `ItemAction`을 상속받는 새로운 ScriptableObject 에셋만 만들면 됩니다. 이는 개발 속도를 크게 향상시키고 버그 발생 가능성을 줄여줍니다.

## 개발 관련 이야기

전략 패턴이라는 디자인 패턴을 공부하면서 프로젝트에 적용해 보았습니다. 다른 분들의 블로그 포스팅과 Claude의 도움을 받아가며 리팩토링을 진행했는데, 아직 완벽하게 원칙대로 적용한게 맞는지 확신이 서지 않습니다. 하지만, 코드가 훨씬 깔끔해지고 유지보수가 쉬워진 것은 확실합니다. 앞으로도 이런 저런 공부를 하면서 프로젝트에 적용하고, 가능하다면 공부한 내용을 블로그에 정리해 공유할 예정입니다.
코드 구조 개선 외에도 새로운 시스템, 무기, 장비 등 다양한 콘텐츠를 추가하고 있습니다. 지난번에 퀘이크 무기를 소개했었는데 앞으로 이런 콘텐츠 추가 사항들은 한꺼번에 정리해서 포스팅하겠습니다.

---

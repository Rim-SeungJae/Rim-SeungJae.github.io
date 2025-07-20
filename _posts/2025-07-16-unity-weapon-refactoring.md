---
title: "Unity 무기 시스템 리팩토링"
date: 2025-07-16 21:00:00 +0900
categories: [프로젝트, Eternal-Survival]
tags: [게임개발, Unity, Eternal Return]
---

## 퀘이크 무기 추가, 그리고 마주한 고민

최근 Eternal Survival 게임에 플레이어의 이동 거리에 따라 주변에 광역 피해를 주는 '퀘이크(Quake)'라는 새로운 무기를 추가하는 작업을 진행했습니다. 이를 진행하면서 코드 구조의 개선이 이루어진 부분이 있어 공유하고자 합니다.

기존에는 `Weapon.cs`라는 스크립트가 근접(Melee) 및 원거리(Range) 무기의 모든 로직을 담당하고 있었습니다. 새로운 퀘이크 무기 역시 피해량, 범위, 쿨타임(여기서는 발동 거리) 등 여러 능력치를 가지며, 레벨업에 따라 이 능력치들이 변화하는 구조였습니다.

처음에는 골드메탈님의 'Undead Survior' 에셋에서 하던 것처럼 `Weapon.cs` 내부에 `Quake` 타입에 대한 `switch` 문을 추가하거나, 아예 새로운 `QuakeWeapon.cs` 파일을 만들어 `Weapon.cs`의 코드를 복사-붙여넣기 하는 것을 고려했습니다. 하지만 곧바로 "이대로 가면 나중에 큰일 나겠다"는 생각이 들었습니다.

## 어떤 문제가 생길 수 있을까?

제 프로젝트는 `ModifiableStat`이라는 강력한 능력치 시스템을 사용하고 있습니다. 이 시스템은 기본 능력치에 장비, 버프, 특성 등 다양한 소스에서 오는 수정치(`StatModifier`)를 적용하여 최종 유효 능력치를 계산해줍니다. 예를 들어, 플레이어가 '공격력 증가 장갑'을 착용하면 모든 무기의 공격력이 자동으로 증가하는 식이죠.

만약 `Weapon.cs`에 `Quake` 로직을 직접 추가하거나, 코드를 복사해서 `QuakeWeapon.cs`를 만들었다면 다음과 같은 문제들이 발생했을 것입니다.

1.  **코드 중복:** `ItemData` 참조, `level` 관리, `ModifiableStat` 변수 선언, `Init()`, `LevelUp()`, `ApplyLevelData()` 등 무기라면 공통적으로 가져야 할 로직들이 여러 곳에 흩어지게 됩니다. 이는 코드의 양을 늘리고, 버그 발생 가능성을 높이며, 유지보수를 어렵게 만듭니다.
2.  **확장성 저하:** 앞으로 새로운 무기 타입(예: 마법, 방어막)이 추가될 때마다 이 'Weapon.cs' 코드의 일부를 계속해서 복사하거나, 거대한 `switch` 문을 확장해야 할 것입니다. 이는 개발 속도를 저하시키고, 새로운 기능 추가 시 기존 코드에 영향을 줄 위험을 키웁니다.

결론적으로, 단순히 기능을 추가하는 것을 넘어, 코드의 구조적 개선을 통해 장기적인 프로젝트의 건강성을 확보해야 한다는 판단을 내렸습니다.

## 해결책: 추상 부모 클래스 `WeaponBase`의 도입

이러한 문제들을 해결하기 위해 객체 지향 프로그래밍의 핵심 원칙인 **상속(Inheritance)**을 활용하기로 했습니다. `Weapon.cs`와 `QuakeWeapon.cs`의 공통 로직을 추출하여 **추상 부모 클래스(Abstract Base Class)**를 만들고, 이를 모든 무기 스크립트가 상속받도록 하는 것이 가장 합리적인 방법이라고 판단했습니다.

`MonoBehaviour`를 상속받는 Unity 컴포넌트이므로, `abstract class MonoBehaviour` 형태로 `WeaponBase.cs`를 설계했습니다.

### `WeaponBase.cs` 설계 및 구현

`WeaponBase`는 다음과 같은 역할을 담당합니다.

- **공통 필드 관리:** `itemData`, `level`과 같은 기본 정보와 `damage`, `count`, `cooldown` 등 모든 무기가 공통으로 사용하는 `ModifiableStat` 인스턴스들을 선언합니다.
- **공통 메서드 구현:**
  - `Awake()`: `ModifiableStat` 인스턴스들을 초기화하고 `GameManager.instance.player` 참조를 가져옵니다.
  - `Init(ItemData data)`: 무기가 처음 생성될 때 호출되어 `ItemData`를 설정하고 `ApplyLevelData()`를 호출합니다.
  - `LevelUp()`: 무기 레벨을 증가시키고 `ApplyLevelData()`를 호출합니다.
  - `ApplyLevelData()`: `ItemData`에 정의된 레벨별 스탯(`damages`, `cooldowns` 등)을 가져와 해당 `ModifiableStat`의 `BaseValue`에 할당합니다. 여기서 'ItemData'에 정의된 레벨별 스탯 배열의 길이가 현재 레벨보다 짧을 경우, 배열의 첫 번째 값(`[0]`)을 기본값으로 사용합니다(레벨과 무관하게 변하지 않는 스탯의 경우를 처리하기 위함).

{% highlight c# %}
// Assets/Undead Survivor/Script/WeaponBase.cs
using UnityEngine;

public abstract class WeaponBase : MonoBehaviour
{
[Header("Common Stats")]
public ItemData itemData;
public int level;

    public ModifiableStat damage;
    public ModifiableStat count;
    public ModifiableStat projectileSpeed;
    public ModifiableStat duration;
    public ModifiableStat attackArea;
    public ModifiableStat cooldown;

    protected Player player;

    public virtual void Awake()
    {
        player = GameManager.instance.player;
        damage = new ModifiableStat(0);
        count = new ModifiableStat(0);
        projectileSpeed = new ModifiableStat(0);
        duration = new ModifiableStat(0);
        attackArea = new ModifiableStat(1);
        cooldown = new ModifiableStat(0);
    }

    public void Init(ItemData data)
    {
        this.itemData = data;
        this.level = 0;
        name = "Weapon " + data.itemName;
        transform.parent = player.transform;
        transform.localPosition = Vector3.zero;
        ApplyLevelData();
    }

    public void LevelUp()
    {
        if (level < itemData.maxLevel)
        {
            this.level++;
            ApplyLevelData();
        }
    }

    protected virtual void ApplyLevelData()
    {
        // 배열의 길이가 레벨보다 짧으면, 인덱스 0의 값을 기본값으로 사용
        damage.BaseValue = (itemData.damages.Length > level) ? itemData.damages[level] : itemData.damages[0];
        count.BaseValue = (itemData.counts.Length > level) ? itemData.counts[level] : itemData.counts[0];
        projectileSpeed.BaseValue = (itemData.projectileSpeeds.Length > level) ? itemData.projectileSpeeds[level] : itemData.projectileSpeeds[0];
        duration.BaseValue = (itemData.durations.Length > level) ? itemData.durations[level] : itemData.durations[0];
        attackArea.BaseValue = (itemData.areas.Length > level) ? itemData.areas[level] : itemData.areas[0];
        cooldown.BaseValue = (itemData.cooldowns.Length > level) ? itemData.cooldowns[level] : itemData.cooldowns[0];
    }

}
{% endhighlight %}

### `Weapon.cs` 및 `QuakeWeapon.cs` 리팩토링

`WeaponBase`가 준비되었으니, 이제 각 무기 스크립트는 `WeaponBase`를 상속받고 자신만의 고유한 공격 로직만 구현하면 됩니다.

**`Weapon.cs` (시간 기반 무기)**

- `WeaponBase`를 상속받습니다.
- `Awake()`에서 `base.Awake()`를 호출하여 부모의 초기화 로직을 실행합니다.
- `ApplyLevelData()`를 오버라이드하여 근접 무기(`Melee`)의 경우 레벨업 시 즉시 `Deploy()`를 호출하도록 합니다.
- `Update()`에서 `timer`를 이용한 쿨타임 기반 공격 로직(`Fire()`)과 근접 무기의 회전 로직만 남깁니다.

{% highlight c# %}
// Assets/Undead Survivor/Script/Weapon.cs
using System.Collections.Generic;
using UnityEngine;

public class Weapon : WeaponBase
{
private float timer;

    public override void Awake()
    {
        base.Awake(); // 부모 클래스의 Awake()를 먼저 호출합니다.
    }

    protected override void ApplyLevelData()
    {
        base.ApplyLevelData();
        if (itemData.itemType == ItemData.ItemType.Melee)
        {
            Deploy();
        }
    }

    void Update()
    {
        if (!GameManager.instance.isLive) return;
        switch (itemData.itemType)
        {
            case ItemData.ItemType.Melee:
                transform.Rotate(Vector3.back * projectileSpeed.Value * Time.deltaTime);
                break;
            case ItemData.ItemType.Range:
                timer += Time.deltaTime;
                if (timer > cooldown.Value)
                {
                    timer = 0f;
                    Fire();
                }
                break;
        }
    }
    // Deploy() 및 Fire() 메서드는 기존과 동일하게 유지

}
{% endhighlight %}

**`QuakeWeapon.cs` (거리 기반 무기)**

- `WeaponBase`를 상속받습니다.
- `Awake()`에서 `base.Awake()`를 호출합니다.
- `Start()`에서 `lastPosition`을 초기화합니다.
- `Update()`에서 플레이어의 이동 거리를 측정하고, `cooldown.Value` (이제 `ModifiableStat`이 적용된 발동 거리)에 도달하면 `Attack()`을 호출합니다.
- `Attack()` 메서드에서 `QuakeEffect`를 생성하고 `damage.Value`, `attackArea.Value`, `duration.Value` 등 `ModifiableStat`이 적용된 최종 능력치를 전달합니다.
- `OnQuakeEffectFinished()` 콜백을 통해 `isQuakeActive` 플래그를 리셋하여 쿨타임 측정을 재개합니다.

{% highlight c# %}
// Assets/Undead Survivor/Script/QuakeWeapon.cs
using UnityEngine;

public class QuakeWeapon : WeaponBase
{
private float distanceTraveled = 0f;
private Vector3 lastPosition;
private bool isQuakeActive = false;

    public override void Awake()
    {
        base.Awake();
    }

    void Start()
    {
        lastPosition = player.transform.position;
    }

    public override void Init(ItemData data) // Init 오버라이드하여 lastPosition 초기화 시점 변경
    {
        base.Init(data);
        lastPosition = player.transform.position;
    }

    void Update()
    {
        if (!GameManager.instance.isLive) return;
        if (!isQuakeActive)
        {
            distanceTraveled += Vector3.Distance(player.transform.position, lastPosition);
            lastPosition = player.transform.position;

            if (distanceTraveled >= cooldown.Value)
            {
                Attack();
                distanceTraveled = 0f;
                isQuakeActive = true;
            }
        }
    }

    private void Attack()
    {
        GameObject effect = GameManager.instance.pool.Get(itemData.projectileTag);
        if (effect == null)
        {
            isQuakeActive = false; // 이펙트 생성 실패 시 즉시 리셋
            Debug.LogWarning($"PoolManager에서 태그 '{itemData.projectileTag}'에 해당하는 이펙트를 가져오지 못했습니다.");
            return;
        }
        effect.transform.position = player.transform.position;
        effect.transform.localScale = Vector3.one * attackArea.Value;

        QuakeEffect effectLogic = effect.GetComponent<QuakeEffect>();
        if (effectLogic != null)
        {
            effectLogic.Init(damage.Value, duration.Value, this);
        }
        AudioManager.instance.PlaySfx(AudioManager.Sfx.Melee);
    }

    public void OnQuakeEffectFinished()
    {
        isQuakeActive = false;
    }

}
{% endhighlight %}

## 리팩토링의 결과와 얻은 이점

이번 리팩토링을 통해 저희는 다음과 같은 중요한 이점들을 얻을 수 있었습니다.

1.  **코드 중복 제거:** 무기 관련 공통 로직이 `WeaponBase` 한 곳으로 모여 코드가 훨씬 간결하고 읽기 쉬워졌습니다.
2.  **유지보수성 향상:** 무기 시스템의 공통적인 변경이 필요할 때, `WeaponBase`만 수정하면 되므로 유지보수 비용이 크게 줄어듭니다.
3.  **뛰어난 확장성:** 앞으로 어떤 새로운 방식의 무기(예: 마법, 방어막)를 추가하더라도, `WeaponBase`를 상속받고 해당 무기만의 고유한 공격 로직만 구현하면 되므로 매우 빠르고 안전하게 기능을 확장할 수 있습니다.

## 첫번째 무기 추가: 퀘이크

이런 변화를 통해 앞으로 무기를 추가할 때의 작업이 더욱 간편해졌습니다. 그리고 첫번째로 추가된 퀘이크 무기의 실제 플레이 모습도 보여드리고자 합니다.
이터널리턴에서 퀘이크는 최대 강화시 일정 시간마다 주변 적에게 피해를 입히는 전술 스킬입니다.
하지만 과거에는 플레이어의 이동 거리에 따라 주변에 광역 피해를 주는 방식이었습니다.
Eternal Survival에서는 퀘이크를 이 과거 버전인 플레이어의 이동 거리에 따라 주변에 광역 피해를 주는 무기로 구현했습니다.
또, 이터널리턴에서 퀘이크는 갈색 원형 충격파 이펙트를 사용하지만, Eternal Survival에서는 스킬의 이름과 아이콘에 걸맞게 바닥에 균열을 생성하는 애니메이션을 재생하도록 구현하였습니다.

![Image](https://github.com/user-attachments/assets/0e0883cb-64d2-4f4d-bb14-87f57dbe7cde)

---

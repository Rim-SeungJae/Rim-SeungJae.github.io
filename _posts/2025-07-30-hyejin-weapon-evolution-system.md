---
title: "혜진 캐릭터 전용 무기 및 무기 진화 시스템 추가"
date: 2025-07-31 12:00:00 +0900
categories: [프로젝트, Eternal-Survival]
tags: [게임개발, Unity, Eternal Return, 게임 콘텐츠]
---

안녕하세요. 이번에는 게임에 정말 큰 변화를 가져온 업데이트를 소개하려고 합니다. 혜진 캐릭터의 전용 무기와 함께 완전히 새로운 **무기 진화 시스템**을 구현했습니다!

![혜진 무기 스크린샷](https://github.com/user-attachments/assets/[이미지-URL-추가-예정])

## 혜진 캐릭터 전용 무기

이터널 리턴의 혜진 캐릭터를 모티브로 한 전용 무기를 추가했습니다. 혜진의 특성에 맞게 원거리 투사체 무기로 구현했습니다.

### 기본 무기: '혜진의 무기'

- **공격 방식**: 가장 가까운 적을 자동으로 타겟팅하여 혜진의 Q스킬 제압부 발사

{% highlight c# %}
/// <summary>
/// 가장 가까운 적을 향해 투사체를 발사합니다.
/// </summary>
private void Attack()
{
// 가장 가까운 적이 없으면 발사하지 않음
if (!player.scanner.nearestTarget) return;

    // 적의 위치와 방향 계산
    Vector3 targetPos = player.scanner.nearestTarget.position;
    Vector3 dir = (targetPos - transform.position).normalized;

    // 풀에서 투사체 가져오기
    Transform bullet = GameManager.instance.pool.Get(weaponData.projectileTag).transform;

    // 투사체 초기화 및 설정
    bullet.position = transform.position;
    bullet.rotation = Quaternion.FromToRotation(Vector3.up, dir);

}
{% endhighlight %}

## 무기 진화 시스템

이번 업데이트의 핵심인 **무기 진화 시스템**을 구현했습니다! 이는 다른 뱀파이어 서바이벌류 게임에서 볼 수 있는 진화 시스템을 참고하여 구현하였습니다.

### 진화 시스템의 특징

**1. 조건부 진화**

- 특정 무기와 특정 레벨에 도달해야 진화 가능
- 현재는 레벨업 시 진화 가능한 무기가 있으면 자동으로 선택지에 등장하지만, 추후 아이템 진화를 가능하게 하는 콘텐츠를 추가할 예정입니다.

**2. WeaponEvolutionManager 시스템**
전체 진화 시스템을 관리하는 중앙 매니저를 구현했습니다:

{% highlight c# %}
/// <summary>
/// 플레이어가 보유한 무기 중 진화 가능한 무기 목록을 반환합니다.
/// </summary>
public List<EvolutionCandidate> GetEvolvableWeapons(Player player)
{
List<EvolutionCandidate> candidates = new List<EvolutionCandidate>();

    foreach (WeaponEvolutionData evolutionData in evolutionDataList)
    {
        if (evolutionData.CanEvolve(player))
        {
            Item originalItem = player.items.Find(item => item.data == evolutionData.originalWeapon);
            if (originalItem != null)
            {
                candidates.Add(new EvolutionCandidate
                {
                    originalItem = originalItem,
                    evolutionData = evolutionData
                });
            }
        }
    }

    return candidates;

}
{% endhighlight %}

## 혜진의 무기 진화

혜진의 기본 무기가 진화하면 완전히 새로운 메커니즘을 가진 무기로 변신합니다!

### '삼매' 스택 시스템

진화된 혜진 무기의 핵심은 **삼매 스택 시스템**입니다: '삼매'는 이터널 리턴에서 혜진의 패시브 스킬로, 혜진이 적에게 스킬을 3회 명중시키면 적에게 '공포' 상태이상을 부여하는 스킬입니다. 그러나, 뱀파이어 서바이벌류 게임에서 적들이 플레이어로부터 도망치게 만드는 상태이상 효과인 '공포'는 밸런스 조절을 힘들게 할 뿐만 아니라 무기가 진화했다고 할만큼 화려한 효과도 아니라고 생각합니다. 대신 삼매가 3스택이 되면 이터널 리턴에서 혜진의 W 스킬인 흡령부가 대상 적의 위치에 발동되도록 구현하였습니다.

1. **스택 누적**: 투사체가 적을 맞힐 때마다 해당 적에게 스택 1개 누적
   ![Image](https://github.com/user-attachments/assets/ae4ec15b-3a26-42f2-9a98-f68e2d8a2678)
2. **시각적 표시**: 적 위에 스택 수를 나타내는 시각 효과 표시
   ![Image](https://github.com/user-attachments/assets/e79765c4-df21-460c-a52f-2d9b984c81fb)
3. **폭발 발동**: 스택이 3개에 도달하면 '흡령부' 발동. 적들을 흡령부의 중심으로 끌어당기며 폭발
   ![Image](https://github.com/user-attachments/assets/4693e4a6-70e2-430a-b74f-c775ef110d3e)
4. **스택 초기화**: 폭발 후 스택 초기화되어 다시 누적 가능

{% highlight c# %}
/// <summary>
/// Three Calamities 스택을 추가합니다.
/// </summary>
public void AddStack(HyejinWeaponEvo weapon, float duration)
{
weaponRef = weapon;
currentStacks++;
stackTimer = duration;

    // 스택 시각 효과 업데이트
    UpdateStackVisual();

    // 3회 스택 달성 시 광역 공격 발동
    if (currentStacks >= 3)
    {
        TriggerCalamitiesExplosion();
        resetCoroutine = StartCoroutine(WaitAndResetStacks(resetDelay));
    }

}
{% endhighlight %}

## 기술적 구현 포인트

### 1. 오브젝트 풀링 최적화

모든 스택 효과와 폭발 이펙트는 오브젝트 풀링을 통해 관리되어 성능을 최적화했습니다.

### 2. 상속 구조 활용

{% highlight c# %}
public class HyejinWeaponEvo : HyejinWeapon
{
protected override void ConfigureBullet(Bullet bulletComponent, Vector3 dir)
{
// 기본 투사체 설정
base.ConfigureBullet(bulletComponent, dir);

        // Three Calamities 효과 추가
        HyejinBulletEvo evoBullet = bulletComponent as HyejinBulletEvo;
        if (evoBullet != null)
        {
            evoBullet.SetEvolutionWeapon(this);
        }
    }

}
{% endhighlight %}

기본 무기의 로직을 상속받으면서 진화 효과만 추가하는 깔끔한 구조로 설계했습니다.

### 3. 코루틴을 활용한 타이밍 관리

스택 초기화, 폭발 딜레이 등 타이밍이 중요한 부분들을 코루틴으로 관리하여 안정적인 동작을 보장했습니다.

## 앞으로의 계획

### 다른 무기들의 진화 시스템

혜진 무기로 검증된 진화 시스템을 바탕으로 다른 무기들의 진화 형태도 추가할 예정입니다:

- **별조각** → 더 큰 범위와 다중 메테오
- **번개** → 연쇄 번개 시스템
- **진실의 칼날** → 다단계 회전 공격

### 캐릭터별 전용 무기 확장

혜진 외에도 다른 이터널 리턴 캐릭터 및 전용 무기를 추가할 계획입니다.

## 개발 후기

무기 진화 시스템을 구현하면서 가장 어려웠던 부분은 **복잡한 상태 관리**였습니다. 스택이 쌓이고, 시각 효과가 표시되고, 폭발이 발동되는 일련의 과정을 버그 없이 구현하는 것은 정말 까다로운 작업이었습니다.

특히 오브젝트 풀링과 코루틴이 함께 동작하는 부분에서 메모리 누수나 참조 오류가 발생하지 않도록 신경 써야 했습니다. 하지만 결과적으로 정말 만족스러운 시스템이 완성되었습니다.

또 이터널 리턴에서 혜진이라는 캐릭터의 스킬 이펙트가 가지는 개성을 최대한 유지하도록 구현하는 것이 정말 어려웠습니다. 아무래도 제가 그림에는 소질이 없다 보니 혜진의 스킬 이펙트를 그대로 구현하기 위해 여러번의 시행 착오가 있었습니다...

다음에 추가할 캐릭터는 유키가 될 것 같습니다. 제가 이터널 리턴에서 정말 좋아하는 캐릭터 중 하나이고, 무엇보다 궁극기인 '화무십일홍'이 정말 멋있어서 제 게임에 이걸 구현하고 싶었습니다. 이번에 터득한 노하우를 바탕으로 다음 캐릭터 구현은 조금 더 서둘러서 해보겠습니다.

---

---
layout: post
title: "보스 특수공격 시스템 리팩토링으로 확장성 확보하기"
date: 2025-08-20 10:00:00 +0900
categories: [Unity, GameDev, Programming]
tags: [Unity, 뱀파이어서바이벌, 리팩토링, 보스시스템]
---

저번에 이어서 현재 보스 시스템에 또다른 문제점을 발견해서 수정하게 되었습니다. 바로 보스들의 기반이 되는 BossBase 클래스의 설계가 보스가 여러개의 특수 공격을 가질 수 없도록 되어 있었기 때문입니다. 물론 BossBase를 상속받은 뒤 BossBase의 함수들을 대부분 오버라이드해서 특수 공격을 구현할 수는 있었지만, 이러면 보스가 많아질수록 코드가 중복되고 유지보수가 어려워지는 문제가 있었습니다. 그래서 이번에는 BossBase를 완전히 리팩토링하여 확장성을 확보하는 방향으로 진행했습니다.

## 문제의 시작점

원래 알파는 '아크 블레이드'라는 하나의 특수 공격만 가지고 있어서 문제가 없었는데, 이제 오메가를 추가하려고 하니 문제가 생겼습니다. 오메가는 '아크 블레이드'와 'VF 에너지 방출'이라는 두개의 특수 공격을 가지고 있었습니다:
하지만 기존 `BossBase` 시스템은 이런 식으로 되어 있었습니다:

{% highlight c# %}
// 기존의 한계적인 구조
protected abstract void PerformSpecialAttack(); // 단 하나의 공격만
protected float specialAttackTimer; // 하나의 타이머
{% endhighlight %}

이걸로는 다중 특수공격이 불가능해서, 그래서 아예 시스템을 처음부터 다시 설계하기로 했습니다.

## 새로운 시스템 설계

### 1. SpecialAttackSystem.cs - 핵심 아키텍처

먼저 특수공격 데이터와 추상 클래스를 정의했습니다:

{% highlight c# %}
[System.Serializable]
public class SpecialAttackData
{
public string attackName = "Special Attack";
public float cooldown = 5f;
public int priority = 1; // 우선순위 시스템

    // 실행 조건들
    public float minDistanceToPlayer = 0f;
    public float maxDistanceToPlayer = float.MaxValue;
    public float minHealthPercentage = 0f;
    public float maxHealthPercentage = 1f;

    public bool canBeInterrupted = false;
    public bool requiresLineOfSight = false;

}

public abstract class SpecialAttackBase : MonoBehaviour
{
[SerializeField] protected SpecialAttackData attackData;

    public virtual bool CanExecute() { /* 조건 체크 */ }
    protected abstract IEnumerator ExecuteAttackSequence();

    // 보스 제어 헬퍼 메서드들
    protected void StartBossImmobilization();
    protected void EndBossImmobilization();

}
{% endhighlight %}

핵심 아이디어는 **각 특수공격을 독립적인 컴포넌트**로 만드는 것이었습니다.

### 2. BossBase 리팩토링

기존 시스템과의 호환성을 유지하면서 새 시스템을 도입했습니다:

{% highlight c# %}
public abstract class BossBase : Enemy
{
[SerializeField] protected List<SpecialAttackBase> specialAttacks;

    protected virtual void TryExecuteSpecialAttack()
    {
        // 실행 가능한 공격들 필터링
        var availableAttacks = specialAttacks
            .Where(attack => attack != null && attack.CanExecute())
            .ToList();

        if (availableAttacks.Count == 0) return;

        // 우선순위 기반 선택
        SpecialAttackBase selectedAttack = SelectAttackByPriority(availableAttacks);
        selectedAttack?.Execute();
    }

    protected virtual SpecialAttackBase SelectAttackByPriority(List<SpecialAttackBase> availableAttacks)
    {
        // 가장 높은 priority를 가진 공격들 중에서 선택
        var sortedAttacks = availableAttacks
            .OrderByDescending(attack => attack.AttackData.priority)
            .ToList();

        int highestPriority = sortedAttacks[0].AttackData.priority;
        var highestPriorityAttacks = sortedAttacks
            .Where(attack => attack.AttackData.priority == highestPriority)
            .ToList();

        // 같은 우선순위가 여러 개면 랜덤 선택
        return highestPriorityAttacks[Random.Range(0, highestPriorityAttacks.Count)];
    }

}
{% endhighlight %}

이제 각 보스는 여러 개의 특수 공격을 가질 수 있고, 각 공격은 독립적으로 실행될 수 있습니다. 또한, 우선순위 시스템을 통해 가장 중요한 공격이 먼저 실행됩니다.

### 3. 실제 구현 예시 - ArcBladeAttack

기존의 알파가 사용하던 아크 블레이드 공격을 새 시스템으로 이식했습니다. 이제 오메가도 해당 공격을 재사용 할 수 있습니다:

{% highlight c# %}
public class ArcBladeAttack : SpecialAttackBase
{
void Awake()
{
attackData = new SpecialAttackData
{
attackName = "Arc Blade",
cooldown = 8f,
priority = 5,
maxDistanceToPlayer = 15f,
canBeInterrupted = false
};
}

    protected override IEnumerator ExecuteAttackSequence()
    {
        try
        {
            StartBossImmobilization(); // 보스 고정

            Vector2 playerDirection = GetDirectionToPlayer();

            // Arc Blade 이펙트 생성
            GameObject effectObject = CreateArcBladeEffect(playerDirection);
            // ... 공격 로직

            yield return new WaitForSeconds(chargeDuration);
            ExecuteArcBladeAttack(attackRange, playerDirection);
        }
        finally
        {
            EndBossImmobilization(); // 반드시 해제
            OnAttackComplete();
        }
    }

}
{% endhighlight %}

## 개발 후기

최근 계속해서 포스팅의 마무리를 '다음에는 신규 보스들을 추가할 예정입니다'로 했는데, 하다보니 문제점이 하나씩 발견되면서 리팩토링을 계속하게 되네요. 하지만 이번 리팩토링은 확장성을 크게 향상시켜서 앞으로 새로운 보스들을 추가하는 데 훨씬 수월해질 것 같습니다. 이제 오메가를 포함한 다양한 보스들이 각자의 특수 공격을 독립적으로 가질 수 있게 되었으니, 다음 포스팅에선 정말로 신규 보스들을 추가한 뒤에 보여드릴 수 있을 것 같습니다. 다만, 이 보스들을 구현하면서 느낀 점인데 픽셀 캐릭터들의 대기, 걷기와 같은 간단한 애니메이션은 제가 유튜브에서 자료를 공부하면서 Aseprite로 직접 그려서 만들 수 있지만, 스킬 이펙트라던가 캐릭터의 복잡한 동작은 아무래도 어렵습니다. 결국 Asset Store에서 적당한 에셋을 찾아서 사용하는 방향으로 가야 할 것 같은데, 원작 게임인 이터널 리턴에서의 느낌을 최대한 살릴 수 있는 에셋을 찾는 게 쉽지 않네요. 최근에 Pixel Lab이라고 하는 픽셀 아트에 최적화된 생성형 AI 플랫폼을 발견했는데, 특히 애니메이션 관련 기능들을 활용하면 프로젝트 진행을 훨씬 효율적으로 진행할 수 있을 것 같아 이것도 최근에 시도해보고 있습니다. 아무튼 이런저런 시행착오를 겪으면서도 계속해서 게임 개발을 이어나가고 있습니다. 다음 포스팅에서는 신규 보스들을 추가한 모습을 보여드릴 수 있기를 기대합니다!

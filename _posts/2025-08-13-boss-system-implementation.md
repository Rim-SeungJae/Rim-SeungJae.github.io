---
title: Unity 보스 시스템 구현기 - Alpha 보스와 셰이더 이펙트
date: 2025-08-13 14:30:00 +0900
categories: [프로젝트, Eternal-Survival]
tags: [게임개발, Unity, 보스시스템, 셰이더, RadialFill]
---

안녕하세요, Eternal Survival 개발 노트입니다.

오늘은 프로젝트에 보스 시스템을 추가하면서 겪었던 설계 과정과 구현상의 도전 과제들, 그리고 셰이더를 활용한 시각적 효과 구현에 대해 이야기하고자 합니다.

### 보스 시스템 아키텍처 설계

기존의 `Enemy` 클래스를 기반으로 하면서도 보스만의 특별한 기능을 추가할 수 있는 확장 가능한 구조가 필요했습니다.

{% highlight c# %}
public abstract class BossBase : Enemy
{
[Header("Boss Settings")]
[SerializeField] protected BossDataSO bossData;
[SerializeField] protected BossHealthBar healthBar;

    protected float specialAttackTimer;
    protected bool isDead = false;

    protected abstract void PerformSpecialAttack();

}
{% endhighlight %}

이 설계의 핵심은 **추상 클래스를 통한 템플릿 메서드 패턴**의 활용입니다. 모든 보스가 공통으로 가져야 할 기능(체력바, 특수 공격 타이밍, 알림 시스템)은 `BossBase`에서 구현하고, 각 보스의 고유한 특수 공격만 하위 클래스에서 구현하도록 했습니다.

### Alpha 보스: 반원 충전 공격의 구현

첫 번째 보스인 Alpha는 Yuki의 궁극기와 유사한 반원 형태의 충전 공격을 사용합니다. 이 공격은 두 단계로 구성됩니다:

1. **충전 단계**: RadialFill을 통한 시각적 예고
2. **공격 단계**: 충전된 영역에 데미지 적용

{% highlight c# %}
protected override void PerformSpecialAttack()
{
if (!isPerformingSpecialAttack)
{
StartCoroutine(ChargeAttackSequence());
}
}

private IEnumerator ChargeAttackSequence()
{
isPerformingSpecialAttack = true;

    // 1단계: 충전 이펙트 생성
    GameObject chargeEffect = GameManager.instance.pool.Get("AlphaChargeEffect");
    AlphaChargeEffect effectScript = chargeEffect.GetComponent<AlphaChargeEffect>();

    // 플레이어 방향으로 회전
    Vector2 directionToPlayer = GetDirectionToPlayer();
    float angle = Mathf.Atan2(directionToPlayer.y, directionToPlayer.x) * Mathf.Rad2Deg - 90f;
    chargeEffect.transform.rotation = Quaternion.Euler(0, 0, angle);

    // 충전 이펙트 시작
    effectScript.StartChargeEffect(chargeDuration, attackDuration, damage);

    yield return new WaitForSeconds(chargeDuration + attackDuration + swirlWaitDuration);

    isPerformingSpecialAttack = false;

}
{% endhighlight %}

### RadialFill 셰이더를 활용한 시각적 피드백

가장 흥미로운 부분은 RadialFill 셰이더를 활용한 시각적 효과 구현이었습니다. 처음에는 유키의 스킬 이펙트가 차오르는 효과를 프레임별로 직접 그려서 애니메이션으로 구현하려고 했습니다. 하지만 프레임별로 그려서 애니메이션으로 구현하는 것은 너무 비효율적이고 관리하기 어려웠습니다.

#### RadialFill 셰이더의 구현 원리

RadialFill 셰이더는 반원 형태의 점진적 채우기 효과를 구현하기 위해 다음과 같은 핵심 기능들을 제공합니다:

{% highlight hlsl %}
Properties
{
\_MainTex ("Texture", 2D) = "white" {}
\_Color ("Color", Color) = (1,1,1,1)
\_FillAmount ("Fill Amount", Range(0, 1)) = 0
\_StartAngle ("Start Angle", Float) = 0
\_Clockwise ("Clockwise", Float) = 1
\_CenterPoint ("Center Point", Vector) = (0.5, 0, 0, 0)
}
{% endhighlight %}

셰이더의 핵심 로직은 fragment shader에서 각 픽셀의 UV 좌표를 기반으로 각도를 계산하고, `_FillAmount` 값에 따라 해당 픽셀을 렌더링할지 결정하는 것입니다:

{% highlight hlsl %}
// 설정 가능한 중심점에서 현재 픽셀까지의 벡터
float2 centerPoint = \_CenterPoint.xy;
float2 centeredUV = i.uv - centerPoint;

// 각도 계산 (atan2 사용하여 -π ~ π 범위)
float angle = atan2(centeredUV.y, centeredUV.x);
angle = degrees(angle); // 라디안을 도(degree)로 변환

// 반원 범위로 각도 정규화 (0도 = 오른쪽, 180도 = 왼쪽)
if (angle < 0) angle += 360;
if (angle > 180) angle = 180; // 반원 범위 제한

// 채우기 진행도 계산 (반원이므로 180도 기준)
float maxFillAngle = 180 \* \_FillAmount;
float alpha = step(fillAngle, maxFillAngle);
{% endhighlight %}

이 구조를 통해 `_FillAmount` 값을 0에서 1로 변화시키면, 반원이 점진적으로 채워지는 효과를 만들 수 있습니다.

{% highlight c# %}
private IEnumerator PlaySwirlEffect()
{
float elapsed = 0f;

    // 1단계: 빠른 채움 효과 (30% 시간)
    float fillDuration = swirlDuration * 0.3f;
    while (elapsed < fillDuration)
    {
        elapsed += Time.deltaTime;
        float progress = elapsed / fillDuration;
        swirlMaterial.SetFloat("_FillAmount", progress);
        yield return null;
    }

    // 2단계: 페이드아웃 (70% 시간)
    float fadeDuration = swirlDuration * 0.7f;
    elapsed = 0f;
    Color originalColor = swirlSpriteRenderer.color;

    while (elapsed < fadeDuration)
    {
        elapsed += Time.deltaTime;
        float fadeProgress = elapsed / fadeDuration;
        Color newColor = originalColor;
        newColor.a = Mathf.Lerp(1f, 0f, fadeProgress);
        swirlSpriteRenderer.color = newColor;
        yield return null;
    }

}
{% endhighlight %}

### Yuki 무기로의 확장

보스 시스템에서 구현한 변경사항들을 대부분 유키의 화무십일홍에도 반영하였습니다. 확장 가능한 형태로 구현하였기 때문에 빠르게 적용할 수 있었습니다.

### 개발 후기

최근 업로드가 많이 없었는데, 사실 오늘 서울에서 OPI 시험을 치르고 왔습니다. AL이상 등급이 목표인지라 시험 대비에 집중하느라 프로젝트에 소홀했습니다ㅎㅎ. 시험과 관련해서는 다른 포스팅을 확인해 주세요.
이번 보스 시스템 구현은 꽤나 까다로운 작업이 많았습니다. 'BossBase'를 'Enemy'클래스를 상속받도록 하고, 각 보스만의 특수 패턴을 추가할 수 있는 확장 가능한 설계를 고민하는데 많은 시간을 쏟은 것 같습니다.
특히, 알파의 특수공격을 구현하면서 셰이더를 활용하는 것이 생각보다 어려웠습니다. 학창 시절 컴퓨터 그래픽스 과목을 수강하며 배운 내용을 더듬어가면서 구현했습니다.
당분간은 현재 구축해놓은 캐릭터 및 보스 시스템을 활용해서 신규 캐릭터 및 보스 구현에 집중하려고 합니다. OPI 시험도 끝났으니 다시 프로젝트에 집중해 보겠습니다.

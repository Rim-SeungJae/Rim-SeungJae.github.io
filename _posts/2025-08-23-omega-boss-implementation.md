---
title: Unity 뱀파이어 서바이벌 게임 - 신규 보스 오메가 구현과 다중 특수공격 시스템
date: 2025-08-23 14:30:00 +0900
categories: [프로젝트, Eternal-Survival]
tags: [게임개발, Unity, 보스시스템]
---

안녕하세요, Eternal Survival 개발 노트입니다.

드디어 오메가 보스를 성공적으로 추가했습니다! 이전 포스팅에서 예고했던 대로, 리팩토링한 보스 특수공격 시스템을 활용해 다중 특수공격을 가진 보스를 구현할 수 있었습니다.
새로운 보스 패턴을 구현하기 위한 에셋을 찾기 위해 에셋 스토어를 뒤지느라 좀 오래 걸렸습니다. 최적화적인 측면에서 Particle System을 활용한 이펙트는 최대한 피하고 가능한 Sprite Animation 기반의 에셋을 찾으려고 했으나, 마땅한 게 없더군요. 결국, Cartoon FX Remaster Free라는 Particle System 기반의 무료 에셋을 활용하기로 했습니다. 이 에셋은 단순한 폭발, 불꽃, 마법 이펙트 등 다양한 효과를 제공하며, 잘만 수정한다면 원작인 이터널 리턴의 분위기를 살리면서 제 프로젝트에 새로운 이펙트들을 구현할 수 있을 것 같았습니다. 아마 유료 버전도 결국 사게 될 것 같은데 지금은 무료 버전으로도 충분한 것 같아서 아직 구매하지는 않았습니다. 에셋의 링크는 다음과 같습니다:
[cartoon-fx-remaster-free](https://assetstore.unity.com/packages/vfx/particles/cartoon-fx-remaster-free-109565)

### 오메가 보스 개요

<img width="192" height="128" alt="Image" src="https://github.com/user-attachments/assets/ae36e6a9-3639-41e5-96c6-37f612a2f0b2" />
오메가는 알파보스와는 다른 전투 스타일을 가진 두 번째 보스입니다:

**특징:**

- **아크 블레이드**: 알파와 동일한 반원형 충전 공격 (재사용)
- **VF 에너지 방출**: 플레이어 위치에 폭발 공격을 가하는 새로운 원거리 공격

### 다중 특수공격 시스템의 실제 구현

이전에 구축한 `SpecialAttackSystem`이 실제로 어떻게 작동하는지 오메가를 통해 보여드리겠습니다.

#### 1. VF 에너지 방출 공격 구현

가장 흥미로운 부분은 새로 추가된 VF Pulse 공격입니다. 지난번의 리팩토링 덕분에 OmegaVFPulseAttack이라는 클래스를 구현하고 BossBase의 specialAttacks 리스트에 추가하는 것으로 간단하게 구현할 수 있었습니다:

{% highlight c# %}
public class OmegaVFPulseAttack : SpecialAttackBase
{
void Awake()
{
attackData = new SpecialAttackData
{
attackName = "VF Pulse",
cooldown = 8f,
priority = 4, // Arc Blade보다 낮은 우선순위
maxDistanceToPlayer = 20f,
canBeInterrupted = false
};
}

    protected override IEnumerator ExecuteAttackSequence()
    {
        // 1. 플레이어 현재 위치 저장
        Vector3 targetPosition = GetPlayerPosition();

        // 2. VF Pulse 이펙트 생성
        GameObject effectObject = CreateVFPulseEffect(targetPosition);
        currentPulseEffect = effectObject.GetComponent<VFPulseEffect>();

        // 3. 경고 단계 시작
        currentPulseEffect.StartWarningPhase(warningDuration, attackRadius, pulseCurve);
        yield return new WaitForSeconds(warningDuration);

        // 4. 폭발 단계
        currentPulseEffect.StartExplosionPhase(explosionDuration);
        ExecuteDamageCheck(targetPosition, actualRange);

        yield return new WaitForSeconds(explosionDuration + 1f);
    }

}
{% endhighlight %}

VF 에너지 방출은 **예고-폭발** 2단계로 구성된 원거리 공격입니다. 이터널 리턴을 플레이 해보신 분들은 익숙하실 겁니다. 오메가가 플레이어의 현재 위치를 추적해 폭발을 일으키고, 잠깐의 폭발 예고 후에 실제 폭발이 일어나 플레이어에게 피해를 주고 공중으로 띄우는 공격입니다.

### 이펙트 시스템

VF 에너지 방출의 시각적 효과는 `VFPulseEffect` 스크립트로 관리됩니다. 이 스크립트는 폭발 예고와 실제 폭발 이펙트를 제어합니다.
폭발 예고 효과는 원형 스프라이트를 활용해 폭발 범위를 시각적으로 표시하며, 폭발이 일어나기 직전이라는 것을 표현하기 위해 에너지가 요동치는 듯한 이펙트를 cartoon-fx-remaster-free 에셋을 활용해 추가했습니다.
폭발 효과도 마찬가지로 cartoon-fx-remaster-free 에셋을 활용해 땅에서 에너지가 쏫아오르는 듯한 이펙트를 추가했습니다.

{% highlight c# %}
// 폭발 예고 페이즈
public void StartWarningPhase(float duration, float radius, AnimationCurve curve)
{
if (!isInitialized) InitializeComponents();

        if (warningRangeRenderer == null)
        {
            Debug.LogWarning("VFPulseEffect: Warning range renderer is not assigned");
            return;
        }

        // 오브젝트가 활성화되어 있는지 확인
        if (!gameObject.activeInHierarchy)
        {
            Debug.LogWarning("VFPulseEffect: Cannot start warning phase - GameObject is inactive");
            return;
        }

        if(chargeParticles == null)
        {
            Debug.LogWarning("VFPulseEffect: Charge particles are not assigned");
            return;
        }

        // 경고 스프라이트 활성화 (원래 스케일 그대로 사용)
        warningRangeRenderer.gameObject.SetActive(true);
        chargeParticles.gameObject.SetActive(true);


        // 초기 투명도 설정 (깜빡임 시작값)
        Color initialColor = warningRangeRenderer.color;
        initialColor.a = 0.3f;
        warningRangeRenderer.color = initialColor;

        // 펄스 애니메이션 시작
        StartWarningPulseAnimation(duration, pulseCurve);

        Debug.Log($"VFPulse Warning Phase started - Duration: {duration}s, Using original scale: {originalWarningScale}");

}

// 폭발 페이즈
public void StartExplosionPhase(float duration)
{
if (!isInitialized) InitializeComponents();

    // 경고 단계 정리
    StopWarningPhase();

    // 폭발 이펙트들 시작
    StartExplosionParticles(duration);

    Debug.Log($"VFPulse Explosion Phase started - Duration: {duration}s");

}
{% endhighlight %}

### 실제 게임플레이에서의 동작

![Image](https://github.com/user-attachments/assets/3151353d-0402-446d-aeae-d5e6fc86543a)

1. **경고 단계**: 플레이어의 현재 위치에 보라색 원이 나타나며 2초간 깜빡이고 에너지가 요동치는 이펙트로 플레이어에게 경고를 줍니다.
2. **폭발 단계**: 2초 후 해당 지역에 폭발이 일어나며 범위 내 플레이어에게 데미지를 입힙니다

### 앞으로의 계획

이제 다중 특수공격 시스템이 완벽하게 작동하는 것을 확인했으니, 다음 보스들(감마, 위클라인)을 원활하게 추가할 수 있을 것 같습니다. 각 보스마다 이터널 리턴에서 사용하는 패턴들을 모두 구현해서 다양한 전투 경험을 제공할 예정입니다.

### 개발 후기

오메가 보스를 구현하면서 이전에 리팩토링한 시스템의 진가를 확실히 느낄 수 있었습니다. 새로운 공격을 추가하는 것이 정말 간단해졌고, 각 공격이 독립적으로 동작하면서도 보스 전체의 AI와 잘 연동되는 것을 확인할 수 있었습니다.

Particle System 기반의 이펙트를 사용하게 되면서 앞으로 퍼포먼스 최적화에도 더 많은 신경을 써야겠다는 생각이 들었습니다. 제가 알기로 Particle System을 활용한 에셋을 채용하는 경우 각 Particle들의 움직임을 계산하는데도 리소스가 소모되고, 프리팹 하나가 여러개의 머터리얼과 셰이더를 활용하는 경우도 있기 때문에 단순한 Sprite Animation에 비해 퍼포먼스에 더 큰 영향을 미치는 것으로 알고 있습니다. 에셋에서 제공하는 이펙트 프리팹을 그대로 사용하지 말고, 주의깊게 살펴보면서 꼭 필요한 이펙트들만 추려내고, 불필요한 머터리얼이나 셰이더는 제거하는 등의 최적화 작업을 꾸준히 해나가야겠습니다.

다음 포스팅에서는 감마 보스와 새로운 공격 패턴들을 소개할 예정입니다. 계속해서 게임의 재미를 높여나가겠습니다!

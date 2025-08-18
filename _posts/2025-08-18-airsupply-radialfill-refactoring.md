---
title: AirSupply 보상 시스템과 RadialFill 효과 대대적 리팩토링
date: 2025-08-18 15:30:00 +0900
categories: [프로젝트, Eternal-Survival]
tags: [게임개발, Unity, 리팩토링, UI애니메이션, DOTween]
---

안녕하세요, Eternal Survival 개발 노트입니다.

오늘은 게임에 새로운 보상 시스템인 **AirSupply(항공보급상자)**를 추가하고, 기존 RadialFill 효과들을 완전히 리팩토링한 내용을 정리해보겠습니다. 특히 이번 리팩토링에서는 Unity의 표준 패턴을 따라 코드 품질을 크게 개선할 수 있었습니다.

## AirSupply 시스템 추가

### 기획 의도

지난번에 보스 몬스터 시스템 구현을 해놓고 잊은 사실이 있었습니다. 바로 보스 몬스터는 처치 보상이 필요하다는 점이죠!
특히 뱀파이어 서바이벌류 게임에서는 보스가 랜덤 박스 보상을 드랍하고, 이걸 통해 무기를 진화시키는 메터니즘이 일반적이기 때문에 아주 중요한 부분이라고 할 수 있겠습니다.

### 핵심 메커니즘

AirSupply의 동작 방식은 다음과 같습니다:

1. **무기 스캔**: 플레이어가 소지한 무기 중 레벨업이 가능한 것들을 찾음
2. **진화 우선**: 진화가 가능한 무기가 있다면 진화를 우선적으로 처리
3. **랜덤 선택**: 여러 후보가 있을 경우 무작위로 하나를 선택
4. **경험치 대체**: 업그레이드할 무기가 없으면 경험치로 대체

{% highlight c# %}
/// <summary>
/// AirSupply 보상을 처리하는 핵심 로직
/// </summary>
public void CollectAirSupply()
{
var upgradableItems = GetUpgradableItems();

    if (upgradableItems.Count > 0)
    {
        // 업그레이드 가능한 아이템 중 랜덤 선택
        int randomIndex = Random.Range(0, upgradableItems.Count);
        var selectedItem = upgradableItems[randomIndex];

        UpgradeItem(selectedItem.item, selectedItem.isEvolution);

        // UI 애니메이션 재생
        if (AirSupplyUI.Instance != null)
        {
            AirSupplyUI.Instance.PlayRewardAnimation(selectedItem.item.data.itemIcon);
        }
    }
    else
    {
        // 업그레이드할 무기가 없으면 경험치 지급
        GameManager.instance.GetExp(fallbackExpAmount);
    }

}
{% endhighlight %}

### UI 애니메이션 시스템

개인적으로 이번 작업에서 가장 신경 쓴 부분이 UI 애니메이션입니다. 단순히 아이템을 받았다는 알림보다는 상자를 여는 과정 자체가 하나의 이벤트가 되도록 연출했습니다.

#### 애니메이션 시퀀스

1. **상자 흔들기 (3초)**: 고전적인 보물상자처럼 갸우뚱거리는 애니메이션
2. **상자 열기**: Animator로 상자가 열리는 모션
3. **빛 효과**: 화면을 가리는 강렬한 빛(아직 적당한 빛 효과 에셋을 찾지 못해서 적용은 안된 상태)
4. **아이템 표시**: 획득한 아이템 아이콘이 등장

{% highlight c# %}
/// <summary>
/// 상자 갸우뚱거리기 애니메이션 - 고전적인 상자 흔들림 연출
/// </summary>
private IEnumerator ShakeBoxAnimation()
{
float elapsed = 0f;

    while (elapsed < shakeDuration)
    {
        // 불규칙한 간격으로 움직임
        float waitTime = Random.Range(0.3f, 0.7f);
        yield return new WaitForSecondsRealtime(waitTime);

        // 좌우 회전 각도 계산
        float rotationAngle = Random.Range(5f, 15f);
        bool rotateLeft = Random.value > 0.5f;
        float targetRotation = rotateLeft ? -rotationAngle : rotationAngle;

        // DOTween으로 부드러운 회전
        var sequence = DOTween.Sequence();
        sequence.Append(boxImage.transform.DORotate(new Vector3(0, 0, targetRotation), 0.08f).SetEase(Ease.OutQuad))
               .Append(boxImage.transform.DORotate(Vector3.zero, 0.12f).SetEase(Ease.InOutQuad))
               .SetUpdate(true); // UnscaledTime 사용으로 시간정지 상태에서도 작동

        elapsed += waitTime + 0.2f;
    }

}
{% endhighlight %}

#### 또 한번의 애니메이션 관련 이슈

처음에 상자 애니메이션을 만들었을 때, 애니메이션이 재생되지 않는 문제가 있었습니다. 이번 문제는 항공보급상자를 획득했을 때, 몬스터들의 움직임을 멈추기 위해서 게임의 시간을 정지시키는데, 이러면 애니메이션들도 정지되기 때문에 발생하였습니다.

애니메이션의 Update Mode를 Unscaled Time으로 설정하니 게임이 정지된 상태에서도 UI 애니메이션을 자연스럽게 재생할 수 있었습니다.

## RadialFill 효과 대대적 리팩토링

저번에 언급했던 RadialFill 머터리얼을 기억하시나요? 유키의 화무십일홍이나 알파의 특수 공격 패턴의 이펙트를 구현하기 위해서 사용했던 머터리얼이죠.

### 기존 문제점들

게임에서 RadialFill 셰이더를 사용하는 곳이 여러 군데 있었습니다:

- **YukiChargeEffect**: 유키 무기의 차오름 효과
- **YukiWeaponEvoEffect**: 유키 진화무기의 휘두르기 효과
- **AlphaChargeEffect**: 알파 보스의 반원 공격 차징

문제는 이 모든 곳에서 비슷한 코드가 중복되고 있다는 점이었습니다.

### 새로운 RadialFillUtils 클래스

{% highlight c# %}
public enum CenterPointType
{
Manual, // 수동 좌표 지정
SpritePivot, // 스프라이트의 pivot 사용
TextureCenter, // 텍스처 중심 (0.5, 0.5)
BottomCenter, // 하단 중심 (0.5, 0)
TopCenter, // 상단 중심 (0.5, 1)
LeftCenter, // 좌측 중심 (0, 0.5)
RightCenter // 우측 중심 (1, 0.5)
}

public static class RadialFillUtils
{
/// <summary>
/// RadialFill 설정을 간단하게 초기화
/// </summary>
public static void SetupRadialFill(Material material, CenterPointType centerType,
Sprite sprite = null, Vector2? manualCenter = null, bool clockwise = true, float startAngle = 0f)
{
if (material == null) return;

        Vector2 calculatedCenter = CalculateCenterPoint(centerType, sprite, manualCenter);

        if (material.HasProperty("_FillAmount"))
            material.SetFloat("_FillAmount", 0f);
        if (material.HasProperty("_Clockwise"))
            material.SetFloat("_Clockwise", clockwise ? 1f : 0f);
        if (material.HasProperty("_StartAngle"))
            material.SetFloat("_StartAngle", startAngle);
        if (material.HasProperty("_CenterPoint"))
            material.SetVector("_CenterPoint", calculatedCenter);
    }

}
// 생략
{% endhighlight %}

이번 리팩토링에서는 모든 RadialFill 효과를 하나의 클래스에 모아서 통합했습니다. PlayFillAnimation, PlaySwirlEffect와 같은 다양한 멤버함수를 활용해서 RadialFill 머터리얼의 다양한 활용 방식을 구현하고, 다양하게 재사용 할 수 있도록 클래스를 설계했습니다.

## 개발 후기

이번 작업은 게임에 새로운 기능을 추가하는 것과 동시에 기존 코드의 품질을 크게 개선할 수 있는 기회였습니다.

특히 항공보급상자 시스템을 추가하면서 저번에 이어서 애니메이션 관련 작업을 많이 하게 되었는데 최근 유니티의 애니메이션 시스템에 관련된 이해도가 점점 깊어지는 것 같아서 기분이 좋습니다.

물론 이번에도 Sprite가 아니라 UI Image에 애니메이션은 어떻게 적용하는지, 애니메이션 클립의 Update Mode가 뭔지 등등 모르는걸 찾아가면서 구현하느라 시간이 좀 걸렸지만, 이렇게 하나씩 배우다 보면 점점 숙련된 개발자가 될 수 있을거라고 생각합니다.

아마도 다음 포스팅은 오메가, 감마, 위클라인 등 새로운 보스의 추가와 관련된 포스팅일거 같습니다. 다음에 뵙겠습니다!

---

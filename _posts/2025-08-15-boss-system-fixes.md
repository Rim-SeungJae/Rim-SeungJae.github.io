---
title: Unity 보스 시스템 디버깅과 개선 - Can Transition To Self 문제 해결
date: 2025-08-15 18:30:00 +0900
categories: [프로젝트, Eternal-Survival]
tags: [게임개발, Unity, 보스시스템, 애니메이터, 디버깅]
---

안녕하세요, Eternal Survival 개발 노트입니다.

지난 포스팅에서 보스 시스템의 기본 아키텍처를 구축했다면, 오늘은 실제 운영 중 발견된 문제들과 그 해결 과정에 대해 이야기하고자 합니다. 특히 Unity Animator Controller의 설정 부분에서 다소 어이없는 문제를 해결하느라 시간을 많이 소비해서 여러분들은 저와 같은 실수를 하지 않기를 바라며 공유해봅니다.

### 애니메이션 루프 문제

알파 보스의 특수 공격 애니메이션에서 치명적인 문제가 발생했습니다. 알파가 특수공격을 하는 동안 특정 애니메이션 클립이 무한 반복해서 재생되도록 애니메이션 클립은 Loop Time이 활성화되어 있고, Animator Controller에서도 Special 상태가 제대로 설정되어 있었지만, 실제로는 애니메이션이 재생되지 않고 멈춰있는 현상이 발생했습니다. 원인을 파악하기 위해 아래와 같은 디버깅 코드를 활용한 결과 normalizedTime이 0~0.1 구간에서만 반복되는 현상이 발생하고 있다는 사실을 알게 되었습니다.

#### 디버깅 시스템 구축

문제를 정확히 파악하기 위해 상세한 애니메이션 디버깅 시스템을 구축했습니다:

{% highlight c# %}
private void DebugAnimationState(string context)
{
if (!enableAnimationDebug || anim == null) return;

    AnimatorStateInfo currentState = anim.GetCurrentAnimatorStateInfo(0);

    // 모든 Bool 파라미터 확인
    bool specialBool = anim.GetBool("Special");
    bool deadBool = anim.GetBool("Dead");

    // 전환 정보
    bool isInTransition = anim.IsInTransition(0);
    string transitionInfo = "";
    if (isInTransition)
    {
        AnimatorTransitionInfo transition = anim.GetAnimatorTransitionInfo(0);
        transitionInfo = $"Transitioning (Progress: {transition.normalizedTime:F3})";
    }

    Debug.Log($"[Alpha Animation Debug] {context}\n" +
             $"- State: {GetAnimationStateName(currentState.fullPathHash)}\n" +
             $"- Special Bool: {specialBool}\n" +
             $"- Normalized Time: {currentState.normalizedTime:F3}\n" +
             $"- Animator Speed: {anim.speed}\n" +
             $"- Is In Transition: {isInTransition}\n" +
             $"- {transitionInfo}");

}
{% endhighlight %}

#### 잘못된 가설들

처음에는 다음과 같은 원인들을 의심했습니다:

1. **Hit 애니메이션 간섭**: 보스가 공격받을 때 BossBase의 부모 클래스인 Enemy 클래스에서 TakeDamage함수에서 Hit 트리거가 활성화 되는데, Alpha 보스의 애니메이션 컨트롤러에는 이 트리거가 없으므로 이것이 Special 상태를 방해한다고 생각했습니다.
2. **Exit Time 설정 문제**: Special 상태에서 다른 상태로의 전환 조건 문제라고 생각했습니다.

하지만 이 모든 가설들은 틀렸습니다.

#### 진짜 원인: Can Transition To Self

문제의 진짜 원인은 **Animator Controller의 "Can Transition To Self" 설정**이었습니다. 이 옵션이 활성화되어 있으면:

- Any State에서 Special Bool이 True로 설정되어 있으면 Transition하도록 설정해 놓았으므로, 계속해서 자기 자신으로 지속적으로 전환을 시도합니다
- 매번 전환할 때마다 애니메이션이 처음부터 다시 시작됩니다
- 결과적으로 normalizedTime이 0 근처에서 계속 리셋됩니다

따라서 Can Transition To Self 옵션을 비활성화 하는 것으로 간단하게 문제를 해결할 수 있었습니다. 이 포스팅을 보고 계신 분들은 Any State에서 Bool 조건으로 애니메이션을 전환할때 반드시 해당 옵션이 활성화 되있는지 확인하시기 바랍니다. 혹은, Trigger 조건으로 전환하는 방법도 있습니다.

### 보스 알림 시스템 개선

보스 시스템과 함께 알림 시스템도 개선했습니다. 기존에는 텍스트만 표시되던 것을 보스 아이콘도 함께 표시하도록 수정했습니다:

{% highlight c# %}
/// <summary>
/// 보스 등장 알림을 표시합니다.
/// </summary>
protected virtual void ShowBossAppearanceNotification()
{
if (BossNotificationUI.Instance != null)
{
BossNotificationUI.Instance.ShowBossAppearance(bossData.bossName, bossData.bossIcon);
}
else
{
Debug.Log($"보스 '{bossData.bossName}' 등장!");
}
}
{% endhighlight %}

이를 위해 `BossDataSO`에 `bossIcon` 필드를 추가하고, 알림 UI에서 아이콘을 표시하도록 수정했습니다.

<img width="1783" height="935" alt="Image" src="https://github.com/user-attachments/assets/206b470f-a6f5-4c2a-aad9-08d1a47e4a7f" />

### 체력바 시각적 개선

보스 체력바에서 수치는 올바르게 업데이트되지만 시각적 fill이 제대로 되지 않는 문제도 해결했습니다. 이는 주로 UI 설정 문제였습니다:

- Slider 컴포넌트의 Fill Rect 설정 확인
- Fill Image의 Image Type을 "Filled"로 설정
- Fill Method를 "Horizontal"로 설정

<img width="126" height="171" alt="Image" src="https://github.com/user-attachments/assets/afe0bfa3-ac2e-43fb-b677-a1c23c76639b" />

### 개발 후기

처음에는 "애니메이션이 루프되지 않는다"나 "애니메이션이 재생되지 않는다"라고 생각했지만, 실제로는 "애니메이션이 계속 리셋된다"가 정확한 문제 정의였습니다. 진짜 문제가 뭔지 찾기까지 너무 오랜 시간이 걸린 것 같습니다.
역시 세밀한 디버깅으로 정확한 문제를 찾는것부터가 문제 해결의 첫걸음인데 이걸 실천하는게 참 어렵네요. 계속 연습하고 더 잘할 수 있도록 노력해야겠습니다.
다음에는 우선 알파의 애니메이션을 좀 손보려고 합니다. 특수 공격 애니메이션을 제가 직접 그려봤는데 역시 제 전문 분야가 아니다보니 썩 마음에 들지 않습니다...
생성형 인공지능의 도움을 받아서 개선할 수 있는데까진 개선해보려고 합니다.
그 다음으로는 오메가, 감마, 위클라인 등 신규 보스들을 추가하게 될 것 같습니다. 오메가는 알파와 매우 비슷하니 걱정이 없는데, 감마와 위클라인은 아직 디자인이 미정이라 조금 걱정이 됩니다.

이번 포스팅은 여기까지 입니다. 다음 포스팅에서 뵙겠습니다.

---
title: Unity 뱀파이어 서바이벌 게임 - 신규 보스 위클라인과 독성 전투 시스템 구현
date: 2025-08-30 15:00:00 +0900
categories: [프로젝트, Eternal-Survival]
tags: [게임개발, Unity, 보스시스템]
---

안녕하세요, Eternal Survival 개발 노트입니다.

드디어 세 번째 보스인 위클라인을 성공적으로 구현했습니다. 루미아섬에서 가장 강력한 몬스터인 위클라인 박사를 어떻게 제 게임에 구현했는지 보여드리려고 합니다.

위클라인은 이전의 알파나 오메가와는 다르게, 완전히 다른 결의 보스 몬스터이기에 여러가지 새로운 도전과제를 안겨주었습니다. 특히 위클라인의 특수공격들은 독성 공격과 지속 효과를 중심으로 설계되어 있어, 이를 게임에 맞게 재해석하고 구현하는 과정이 매우 흥미로웠습니다. 무엇보다 제 픽셀 아트 제작 실력에 큰 변화가 있었습니다. 최근 유튜브에서 접하게 된 채널이 하나 있는데, 이 채널에서 픽셀 아트 제작에 대한 많은 팁과 기법을 배울 수 있었습니다. 덕분에 이번 위클라인 보스의 스프라이트와 이펙트 제작에 큰 도움이 되었습니다. 관심 있으신 분들은 아래 링크를 참고해보세요:
[Youtube: AdamCYounis](https://www.youtube.com/@AdamCYounis)j

특히 이번 위클라인 박사의 픽셀 아트를 제작하는데 Sub-pixel, Secondary motion 같은 기법들을 적용해 이전보다 훨씬 더 역동적이고 생동감 있는 캐릭터를 만들 수 있었습니다.

### 위클라인 보스 개요

![Image](https://github.com/user-attachments/assets/fbe1ec12-6044-4d73-a1db-4dd625f6f476)
(어떤가요? 애니메이션이 훨씬 더 자연스럽고 역동적으로 변한 것 같지 않나요?)

위클라인은 원작 게임 이터널 리턴에서 게임의 최종단계에 등장하는 몬스터인 만큼 총 5가지라는 어마어마한 양의 특수공격 패턴을 가지고 있습니다. 제 프로젝트에서는 그중 3가지를 우선 구현했습니다:

**특징:**

- **트리플렛 코드**: 3방향으로 작살 투사체를 발사하는 투사체 공격
- **유독성 발걸음**: 이동하면서 독성 장판을 생성하는 지속 공격(이미 플레이어의 무기로 구현된 시스템 재활용)
- **신경가스 살포**: 자기 자신에게 공격속도 및 이동속도 버프를 주는 범위 강화 공격(제 게임에는 공격속도라는 개념이 없어서 접촉 시 데미지를 증가시키는 방향으로 변경했습니다)
- **돌진 패턴(미구현)**: 위클라인이 현재 대상이 된 플레이어에게 돌진해 피해를 주는 패턴입니다. 제 게임에 이걸 구현하게 되면, 단순히 이동속도를 증가시키는 형태가 될텐데 이는 앞선 신경가스 살포 패턴과 중복되는 부분이라 우선은 구현하지 않았습니다.
- **체력 회복 및 넉백(미구현)**: 위클라인이 일정시간 정신을 집중한 뒤, 체력을 회복하고 주변 플레이어를 밀쳐내는 패턴입니다. 패턴의 이펙트가 재현하기 좀 어려운 부분이 있어서 아직 구현하지 못했습니다.

### 1. 트리플렛 코드 - 정밀 투사체 시스템

첫 번째 특수공격인 트리플렛 코드는 플레이어 방향으로 3개의 작살 투사체를 발사하는 공격입니다.

{% highlight c# %}
public class WickelineTripletCodeAttack : SpecialAttackBase
{
protected override IEnumerator ExecuteAttackSequence()
{
try
{
// 공격 시전 중 물리적 고정 시작
StartBossImmobilization();

            // 1. 플레이어 방향 계산
            Vector2 playerDirection = GetDirectionToPlayer();

            // 2. 3개 방향 계산 (중앙, 좌측 +30도, 우측 -30도)
            Vector2[] attackDirections = CalculateAttackDirections(playerDirection);

            // 3. 궤적 표시 시작 (1초간)
            yield return StartCoroutine(DisplayTrajectories(attackDirections));

            // 4. 투사체 발사
            LaunchProjectiles(attackDirections);

            // 투사체 발사 후 물리적 고정 해제
            EndBossImmobilization();
        }
        finally
        {
            // 안전장치: 물리적 고정 해제
            EndBossImmobilization();
            CleanupTrajectoryIndicators();
        }
    }

    private Vector2[] CalculateAttackDirections(Vector2 baseDirection)
    {
        Vector2[] directions = new Vector2[3];

        // 기본 방향 (플레이어 방향)
        directions[0] = baseDirection.normalized;

        // 좌측 방향 (+30도)
        float leftAngle = Mathf.Atan2(baseDirection.y, baseDirection.x) + (angleOffset * Mathf.Deg2Rad);
        directions[1] = new Vector2(Mathf.Cos(leftAngle), Mathf.Sin(leftAngle)).normalized;

        // 우측 방향 (-30도)
        float rightAngle = Mathf.Atan2(baseDirection.y, baseDirection.x) - (angleOffset * Mathf.Deg2Rad);
        directions[2] = new Vector2(Mathf.Cos(rightAngle), Mathf.Sin(rightAngle)).normalized;

        return directions;
    }

}
{% endhighlight %}

이 공격의 핵심은 **궤적 표시 시스템**입니다. 투사체를 발사하기 1초 전에 플레이어가 회피할 수 있도록 궤적을 미리 보여주는 시스템을 구현했습니다:

{% highlight c# %}
public class TrajectoryIndicator : MonoBehaviour
{
public void Initialize(Vector3 startPos, Vector3 endPos, float width, float duration)
{
// SpriteRenderer를 사용한 궤적 표시
Vector3 centerPosition = (startPos + endPos) \* 0.5f;
transform.position = centerPosition;

        // 궤적 길이와 회전 계산
        Vector3 direction = endPos - startPos;
        float length = direction.magnitude;
        float angle = Mathf.Atan2(direction.y, direction.x) * Mathf.Rad2Deg;

        transform.rotation = Quaternion.AngleAxis(angle, Vector3.forward);
        transform.localScale = new Vector3(length, width, 1f);

        // 페이드 애니메이션 시작
        StartCoroutine(FadeAnimation(duration));
    }

}
{% endhighlight %}

### 2. 유독성 발걸음 - 지속 독성 시스템

두번째 특수공격은 위클라인이 이동하는 동안 이동 경로에 독성 장판을 생성하는 패턴입니다. 이 패턴은 코발트 프로토콜에서 유독성 발걸음이라는 이름의 인퓨전으로도 등장하기에 플레이어의 무기로 이미 구현이 되어 있던 시스템을 재활용했습니다. 다만 이제 고민중인 점은 그러면 플레이어의 유독성 발걸음과 위클라인의 유독성 발걸음을 어떻게 구분할 수 있도록 시각적 효과를 줄 수 있을까 하는 점입니다. 색깔을 다르게 하자니 이터널리턴의 유독성 발걸음과 거리가 멀어지는 것 같고, 테두리 색깔을 줘서 구분하자니 이질적인 느낌이 들고 구분도 명확하게 잘 되지 않는 것 같습니다. 해당 문제는 좀 더 고민해봐야 할 것 같습니다.:

{% highlight c# %}
public class WickelineNoxiousAftermath : MonoBehaviour
{
void Update()
{
if (!GameManager.instance.isLive || !isEnabled) return;

        // 특수공격 중에는 비활성화
        if (ownerBoss != null && ownerBoss.IsPerformingSpecialAttack()) return;

        ProcessMovement();
    }

    private void ProcessMovement()
    {
        Vector3 currentPosition = transform.position;
        Vector3 moveVector = currentPosition - lastPosition;
        float moveDistance = moveVector.magnitude;

        // 최소 이동 거리 체크
        if (moveDistance > minMoveSpeed * Time.deltaTime)
        {
            accumulatedDistance += moveDistance;
            lastMoveDirection = moveVector.normalized;

            // 일정 거리마다 장판 생성
            while (accumulatedDistance >= spawnDistance)
            {
                Vector3 spawnPos = Vector3.Lerp(lastPosition, currentPosition,
                    1f - (accumulatedDistance / moveDistance));

                SpawnNoxiousPuddle(spawnPos, lastMoveDirection);
                accumulatedDistance -= spawnDistance * (1f - overlapFactor);
            }
        }

        lastPosition = currentPosition;
    }

}

### 3. 신경가스 살포 - 위치 기반 버프 시스템

위클라인이 자신의 위치에 신경가스 영역을 생성하고, 그 영역 안에 있는 동안 이동속도와 접촉 데미지가 증가하는 버프를 받는 시스템입니다.

{% highlight c# %}
public class WickelineNerveGasAttack : SpecialAttackBase
{
void Update()
{
// 신경가스 영역이 활성화되어 있을 때만 버프 상태 업데이트
if (currentGasArea != null && currentGasArea.IsActive())
{
UpdateWickelineBuff();
}
}

    private void UpdateWickelineBuff()
    {
        bool shouldHaveBuff = IsWickelineInGasArea();
        bool currentlyHasBuff = HasBuff();

        if (shouldHaveBuff && !currentlyHasBuff)
        {
            // 버프 적용
            ApplyBuff(true);
        }
        else if (!shouldHaveBuff && currentlyHasBuff)
        {
            // 버프 제거
            ApplyBuff(false);
        }
    }

    private bool IsWickelineInGasArea()
    {
        if (currentGasArea == null || ownerBoss == null) return false;
        if (!currentGasArea.IsActive()) return false;

        // 신경가스 영역의 중심과 위클라인 위치 비교
        Vector3 gasAreaCenter = currentGasArea.transform.position;
        Vector3 wickelinePosition = ownerBoss.transform.position;

        // RangeIndicator 기반의 실제 범위 사용
        float actualRange = currentGasArea.GetActualGasAreaRange();
        float distanceToCenter = Vector3.Distance(wickelinePosition, gasAreaCenter);

        return distanceToCenter <= actualRange;
    }

    private void ApplyBuff(bool apply)
    {
        if (ownerBoss == null) return;

        if (apply)
        {
            // 버프 적용
            ownerBoss.speed *= speedMultiplier;
            ownerBoss.contactDamage *= damageMultiplier;
        }
        else
        {
            // 버프 제거
            ownerBoss.speed /= speedMultiplier;
            ownerBoss.contactDamage /= damageMultiplier;
        }
    }

}
{% endhighlight %}

### 실제 게임플레이에서의 동작

![Image](https://github.com/user-attachments/assets/3151353d-0402-446d-aeae-d5e6fc86543a)

1. **트리플렛 코드**: 1초간 궤적 표시 후 3방향 투사체 발사
   ![Image](https://github.com/user-attachments/assets/c9bb4c8b-694d-49dc-8859-dfb693734bcd)
2. **유독성 발걸음**: 위클라인이 이동하는 경로에 독성 장판 생성
3. **신경가스 살포**: 파티클 효과와 함께 버프 영역 생성, 위클라인이 강화된 상태로 플레이어 추격
   ![Image](https://github.com/user-attachments/assets/c71e6bfe-c608-4de7-8517-b8401324f914)

### 개발 후기

위클라인 보스를 구현하면서 가장 인상깊었던 것은 **시스템의 모듈화**가 얼마나 중요한지 다시 한 번 느낀 점입니다. 각 특수공격이 독립적인 컴포넌트로 구현되어 있어서, 하나의 공격에 문제가 생겨도 다른 공격들에는 영향을 주지 않았고, 각각을 개별적으로 테스트하고 디버깅할 수 있었습니다.

또한 태그 기반 플레이어 감지 시스템으로의 전환을 통해 레이어 설정 오류로 인한 예상치 못한 버그들을 많이 해결할 수 있었습니다. 앞으로도 이런 시스템적 개선을 통해 더 안정적인 게임을 만들어나가겠습니다.

특히 신경가스의 위치 기반 버프 시스템은 단순한 시간 기반 버프보다 훨씬 더 전략적이고 흥미로운 게임플레이를 만들어냈다고 생각합니다. 플레이어는 위클라인이 버프를 받는 영역에서 벗어나도록 유도할 수 있고, 위클라인은 버프를 유지하기 위해 영역 안에서 전투해야 하는 딜레마가 생겨 더 역동적인 전투가 가능해졌습니다.

다음 포스팅에서는 감마 보스와 함께 보스 난이도 밸런싱에 대한 내용도 다뤄보겠습니다. 계속해서 게임의 재미를 높여나가겠습니다!

---
title: "유키 캐릭터 및 진화 무기 '화무십일홍' 추가"
date: 2025-08-04 21:00:00 +0900
categories: [프로젝트, Eternal-Survival]
tags: [게임개발, Unity, Eternal Return, 게임 콘텐츠]
---

안녕하세요. 이터널 리턴의 인기 캐릭터 **유키**와 유키의 진화무기 **'화무십일홍'**을 게임에 구현했습니다!

## 유키 캐릭터 추가

유키는 이터널 리턴에서 양손검 및 쌍검 무기를 사용하는 근접 전투 전문 캐릭터로 활약하고 있습니다. 특히, 유키의 궁극기 '화무십일홍'은 이터널 리턴에서는 적중시키기 정말 까다로운 스킬이지만 화려한 벚꽃문양 이펙트와 함께 적을 베어서 큰 데미지를 주는 임팩트 있는 스킬입니다.

### 유키의 기본 무기: '유키의 무기'

![Image](https://github.com/user-attachments/assets/32e4ceec-b126-4919-bf5d-262eb7ecb15f)

유키의 기본 무기는 유키의 Q스킬 '머리치기!'를 모티브로 구현했습니다.

- **공격 방식**: 가장 가까운 적을 향해 내려찍는 검기 시전.
- **특징**: 빠른 연사력과 안정적인 타겟팅

{% highlight c# %}
/// <summary>
/// 유키 무기의 기본 공격 패턴
/// </summary>
protected virtual void Attack()
{
if (!player.scanner.nearestTarget) return;

    // 타겟 방향 계산
    Vector3 targetPos = player.scanner.nearestTarget.position;
    Vector3 dir = (targetPos - transform.position).normalized;

    // 투사체 생성 및 설정
    Transform bullet = GameManager.instance.pool.Get(data.projectileTag).transform;
    bullet.position = transform.position;
    bullet.rotation = Quaternion.FromToRotation(Vector3.up, dir);

    // 투사체 초기화
    YukiProjectile projectile = bullet.GetComponent<YukiProjectile>();
    projectile.Init(damage.Value, 1, dir);

}
{% endhighlight %}

## 진화 무기: '화무십일홍'

유키의 무기가 진화하면 **완전히 새로운 메커니즘**을 가진 '화무십일홍'이 됩니다.
화무십일홍은 유키에게 가장 가까운 적을 향해 **반원형 범위 공격**을 시전합니다. 이터널 리턴에서의 화무십일홍과 최대한 비슷한 느낌이 들도록 노력했습니다.:

#### 1단계: 시전대기 (Charging)

- 가장 가까운 적 방향으로 반원형 공격 범위가 나타남
- 애니메이션과 함께 공격 범위가 점진적으로 차오름
- 시전대기 시간 동안 **공격 범위가 플레이어를 따라다님**

#### 2단계: 베기 공격 (Slash Attack)

- 차오름이 완료되면 즉시 반원 범위 내 모든 적에게 피해 적용
- 피해를 받은 적들에게 **'화무십일홍 마크'** 부여

![Image](https://github.com/user-attachments/assets/7d7a9eac-c962-4e8d-a827-a4c2403f265d)

#### 3단계: 마크 폭발 (Mark Explosion)

- 마크가 부여된 적들은 일정 시간 후 **위치와 관계없이** 폭발 피해를 받음
- 적이 도망쳐도 마크 폭발은 반드시 발동

![Image](https://github.com/user-attachments/assets/b744ce70-09bd-4357-baff-c64d0ba2f547)

{% highlight c# %}
/// <summary>
/// 반원 공격의 전체 시퀀스를 관리합니다.
/// </summary>
private IEnumerator AttackSequence()
{
// 1. 시전대기 애니메이션 시작 및 속도 조절
if (animator != null)
{
// 애니메이션 속도를 chargeDuration에 맞춰 동적 조절
AnimationClip[] clips = animator.runtimeAnimatorController.animationClips;
float animationClipLength = GetAnimationLength(clips);
float animationSpeed = animationClipLength / chargeDuration;
animator.speed = animationSpeed;

        animator.SetTrigger("StartCharge");
    }

    // 2. 차오름 지속 시간 동안 대기
    yield return new WaitForSeconds(chargeDuration);

    // 3. 애니메이션 속도 정상화
    if (animator != null)
    {
        animator.speed = 1.0f;
    }

    // 4. 베기 공격 실행
    ExecuteSlashAttack();

    // 5. 이펙트 정리
    yield return new WaitForSeconds(0.5f);
    DeactivateEffect();

}
{% endhighlight %}

## 기술적 내용

### 1. 기술적 구현 포인트

Collider를 너무 많이 사용하는 경우, 물리 연산의 부담으로 인해서 성능이 저하된다고 알고 있습니다. 따라서 기존에는 주로 `OverlapCircleAll`이나 `OverlapBoxAll` 등을 사용해 왔는데, 이번에 유키의 화무십일홍 같은 경우 완벽한 반원이 아닌 반타원형에 가깝기 때문에 어쩔 수 없이 **PolygonCollider2D**를 활용한 충돌 검사를 구현했습니다. 추후에 문제가 생길 경우 화무십일홍 이펙트를 완벽한 반원으로 수정하고, 'OverlapCircleAll'로 대체해야 할 수도 있겠습니다.:

{% highlight c# %}
/// <summary>
/// PolygonCollider2D를 사용한 정확한 충돌 검사
/// </summary>
private void SlashEnemiesInSemicircle()
{
// PolygonCollider 일시적 활성화
effectCollider.enabled = true;

    // 정확한 모양으로 충돌 검사
    ContactFilter2D contactFilter = new ContactFilter2D();
    contactFilter.SetLayerMask(Physics2D.AllLayers);
    contactFilter.useTriggers = true;

    List<Collider2D> results = new List<Collider2D>();
    Physics2D.OverlapCollider(effectCollider, contactFilter, results);

    // 충돌한 적들에게 피해 및 마크 적용
    foreach (Collider2D target in results)
    {
        if (target.CompareTag("Enemy"))
        {
            Enemy enemy = target.GetComponent<Enemy>();
            enemy.TakeDamage(slashDamage);
            ApplyMarkToEnemy(enemy);
        }
    }

    effectCollider.enabled = false;

}
{% endhighlight %}

### 2. 컴포넌트 기반 마크 시스템

**프리팹 기반 마크 시스템**을 활용해 1타와 2타로 나누어져있는 화무십일홍의 메커니즘을 구현했습니다. 혜진 진화무기의 삼매 스택과 같은 방식입니다.:

{% highlight c# %}
/// <summary>
/// 프리팹 기반 마크 시스템
/// </summary>
private void ApplyMarkToEnemy(Enemy enemy)
{
// 풀에서 마크 프리팹 가져오기
GameObject markEffect = GameManager.instance.pool.Get("YukiWeaponEvo_Mark");
if (markEffect != null)
{
// 마크를 적의 자식으로 배치
markEffect.transform.position = enemy.transform.position;
markEffect.transform.SetParent(enemy.transform);
markEffect.SetActive(true);

        // 마크 초기화
        YukiWeaponEvoMark markComponent = markEffect.GetComponent<YukiWeaponEvoMark>();
        markComponent.InitializeMark(markExplosionDamage, markDuration);
    }

}
{% endhighlight %}

## 앞으로의 계획

### 혜진 도트 수정

유키 캐릭터의 경우 픽셀 아트 스타일로 그려내는데 생성형 인공지능의 도움을 정말 많이 받았습니다. 그리고 나서 제가 직접 그린 혜진의 도트를 보니까 어딘가 허접한 느낌을 지우기가 힘드네요ㅎㅎ. 빠른 시일 내에 혜진의 도트를 수정해서 새로운 스프라이트 시트를 만들 예정입니다.

### 다른 무기들의 진화 시스템

- **별조각** → 더 큰 범위와 다중 메테오
- **번개** → 연쇄 번개 시스템
- **진실의 칼날** → 다단계 회전 공격

### 캐릭터별 전용 무기 확장

유키 외에도 다른 이터널 리턴 캐릭터 및 전용 무기를 추가할 계획입니다.

## 개발 후기

드디어 두번째 캐릭터 유키의 개발이 끝났습니다. 그래도 첫 캐릭터였던 혜진때 보다는 훨씬 빠르고 효율적으로 개발한 것 같습니다.

이번에도 역시 이터널 리턴에서의 유키의 느낌을 살리면서 구현하는게 쉽지 않았습니다. 유키의 궁극기 '화무십일홍'을 떠올릴 때 보통 바닥에 깔리는 벚꽃 문양 이펙트만 생각나지만, 실제로 한단계씩 뜯어보면 '벚꽃 문양 이펙트 -> 유키의 잔상이 전방을 베어내는 모션과 함께 적에게 피격 이펙트 -> 피격 이펙트 이후 적의 머리위에 새겨지는 벚꽃 문양 -> 유키의 잔상이 검을 검집에 집어넣는 모션과 함께 벚꽃 문양 폭발'과 같이 정말 다양한 효과가 있습니다. 이런 효과들을 완벽하게 그대로 구현해내기는 어렵지만 최대한 간소화 하더라도 원래의 느낌을 유지하는 것이 중요한 것 같습니다.

앞으로도 이터널 리턴의 매력적인 캐릭터들을 하나씩 추가해나가면서, 각 캐릭터만의 독특함을 살린 무기들을 구현해보겠습니다.

---

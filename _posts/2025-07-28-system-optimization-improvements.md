---
title: "게임 시스템 최적화 및 코드 품질 개선"
date: 2025-07-28 22:30:00 +0900
categories: [프로젝트, Eternal-Survival]
tags: [게임개발, Unity, 게임 시스템, 성능 최적화]
---

안녕하세요. 최근 Claude Code나 Gemini Cli와 같은 툴을 활용하면 단순히 인공지능에게 코드를 복사+붙여넣기로 전달해서 수정된 코드를 다시 복사+붙여넣기로 옮겨넣지 않아도 인공지능이 프로젝트 코드 전체를 분석하고 수정할 수 있다는 사실을 알게 되었습니다. 이번 포스팅에서는 이런 Claude Code를 활용해 프로젝트 코드에서 문제점들과 개선 방안을 발견한 내용을 정리해보겠습니다.

## 게임 상수 중앙화 (GameTags 클래스)

기존에 코드 곳곳에 하드코딩되어 있던 태그 문자열들을 중앙 관리하는 `GameTags` 클래스를 만들었습니다.

### 개선 전

{% highlight c# %}
// 코드 곳곳에 하드코딩된 문자열들
if (collision.gameObject.tag == "Enemy")
if (target.CompareTag("Player"))
// 오타 발생 가능성과 유지보수의 어려움
{% endhighlight %}

### 개선 후

{% highlight c# %}
public static class GameTags
{
public const string ENEMY = "Enemy";
public const string DESTRUCTIBLE = "Destructible";
public const string AREA = "Area";
public const string PLAYER = "Player";
}

// 사용 예시
if (collision.gameObject.CompareTag(GameTags.ENEMY))
if (target.CompareTag(GameTags.PLAYER))
{% endhighlight %}

**개선 효과:**

- 오타로 인한 버그 방지
- 태그 변경 시 한 곳에서만 수정하면 됨
- 코드 가독성 향상
- IDE의 자동완성 지원

## 적 관리 시스템 최적화

게임에서 적의 수가 많아지면서 성능 병목 현상이 발생하는 것을 확인하고, 적 관리 방식을 대폭 개선했습니다.

### 적 등록/해제 시스템 구현

**GameManager에 활성 적 리스트 추가:**
{% highlight c# %}
public class GameManager : MonoBehaviour
{
private List<Enemy> activeEnemies = new List<Enemy>();

    public void RegisterEnemy(Enemy enemy)
    {
        if (!activeEnemies.Contains(enemy))
        {
            activeEnemies.Add(enemy);
        }
    }

    public void UnregisterEnemy(Enemy enemy)
    {
        activeEnemies.Remove(enemy);
    }

}
{% endhighlight %}

**Enemy 클래스에서 자동 등록/해제:**
{% highlight c# %}
void OnEnable()
{
GameManager.instance.RegisterEnemy(this);
}

void OnDisable()
{
GameManager.instance.UnregisterEnemy(this);
}
{% endhighlight %}

**성능 개선 결과:**

- 시간 정지와 같이 모든 적에 적용해야 하는 효과 최적화

### 가시성 체크 로직 개선

카메라 영역 밖의 적들에 대한 불필요한 연산을 제거했습니다:

{% highlight c# %}
// 화면 밖 적들은 복잡한 AI 로직 스킵
if (!IsVisibleFromCamera())
{
// 기본적인 이동만 수행
SimpleMovement();
return;
}

// 화면 안의 적들만 전체 AI 로직 실행
FullAILogic();
{% endhighlight %}

**성능 개선 결과:**

- 밤/낮 기능으로 인한 잦은 연산 최소화

## 오브젝트 풀 매니저 동적 확장

객체를 동적으로 풀링할 때, 풀에 사용 가능한 객체가 없으면 한번에 여러개의 객체를 생성하여 풀에 추가하는 기능을 추가했습니다.

### 개선 전

{% highlight c# %}
public GameObject Get(string poolTag)
{
// 풀에 사용 가능한 객체가 없으면 null 반환
// 이로 인해 게임 중 오류 발생 가능
}
{% endhighlight %}

### 개선 후

{% highlight c# %}
public GameObject Get(string poolTag)
{
// 사용 가능한 객체가 없으면 자동으로 풀 확장
if (availableObjects.Count == 0)
{
ExpandPool(poolTag, 10); // 10개씩 추가 생성
}

    return availableObjects[0];

}

private void ExpandPool(string poolTag, int expandCount)
{
for (int i = 0; i < expandCount; i++)
{
GameObject newObj = Instantiate(poolPrefab);
// 풀에 추가
}
}
{% endhighlight %}

**개선 효과:**

- 한번에 한개씩 풀에 추가하던 코드에 비해 오브젝트 생성 빈도가 낮아짐

## 코드 품질 개선사항

### 1. 매직 넘버 제거

{% highlight c# %}
// 개선 전
if (health <= 0) // 0이 무엇을 의미하는지 불명확

// 개선 후
private const float MIN_HEALTH = 0f;
if (health <= MIN_HEALTH) // 의미가 명확해짐
{% endhighlight %}

### 2. 클래스 간 결합도 감소

- 직접적인 참조 대신 이벤트 시스템 활용
- Singleton 패턴 남용 방지
- 인터페이스를 통한 의존성 주입

### 3. 주석 및 문서화 개선

{% highlight c# %}
/// <summary>
/// 메테오 이펙트를 초기화하고 낙하 시퀀스를 시작합니다.
/// </summary>
/// <param name="dmg">메테오가 입힐 피해량</param>
/// <param name="attackArea">피해 범위</param>
/// <param name="targetPos">메테오가 떨어질 위치</param>
public void Init(float dmg, float attackArea, Vector3 targetPos)
{% endhighlight %}

## 분석

Claude의 리팩토링 제안 사항을 살펴보니, Unity Profiler를 활용해 성능 병목 지점을 찾아내고 집중적으로 개선한다는 점을 발견했습니다.
앞으로 저도 Unity Profiler를 활용해 최적화에 신경쓰는 연습을 해야겠습니다.

## 개발 후기

최근 여러가지 AI 툴이 개발됨에 따라서 1인 게임 개발이 정말 편리해진 것 같습니다. 특히, 제가 이번 프로젝트를 시작할 수 있었던 것도 생성형 인공지능의 이미지 생성 기능을 활용해 제가 문외한인 그림 분야에서 큰 도움을 받을 수 있었기 때문입니다.
앞으로도 이런 인공지능 툴을 활용해서 1인 개발의 생산성을 높일 수 있는 방안들을 공부하고 적용해보고 싶습니다.

---

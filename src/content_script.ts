import * as $ from "jquery"
import {sortBy, toPairs} from "lodash-es"

const isMobile = document.location.host == "m.habr.com"
function m(desktopCls: string, mobileCls: string) {
  return isMobile ? mobileCls : desktopCls
}

const habrSelectors = {
  commentHead: m(".comment__head", ".tm-comment__header"),
  commentTitle: m(".comments-section__head", ".tm-article-comments__title"),
  commentNav: m(".inline-list_comment-nav", ".tm-comment-head__datetime"),
  listComments: m(".content-list_comments", ".tm-article-comments__inner"),
  commentMessage: m(".comment__message", ".tm-comment-body__content"),
  commentFooter: m(".comment__footer", ".comment__footer"),
  commentReplayForm: m(".comment__reply-form", ".comment__reply-form"),
  itemComment: m(".content-list__item_comment", ".tm-comment"),
  comment: m(".comment", ".tm-comment__comment"),
  score: m(".js-score", ".tm-comment-head__score"),
  nestedCommentsContainer: m(".content-list_nested-comments", ""),
  mobileCommentLink: "a.tm-article-comments",
}

const cls = {
  negative: m("voting-wjt__counter_negative", "tm-comment-head-score_negative"),
  positive: m("voting-wjt__counter_positive", "tm-comment-head-score_positive"),
  counter: m("", "tm-comment-head-score"),
  hightlight: "habr-comments-hightlight",
  hide: "habr-comments-hide",
  openComment: "habr-comments-open-comment",
  scores: "habr-comments-scores",
}

let isInit = false
let intervalId: number
let currentScore: number | undefined = undefined
init()
if (isMobile) {
  $(habrSelectors.mobileCommentLink).on("click", () => {
    intervalId = setInterval(() => {
      init()
    }, 1000)
  })
}

function init() {
  if (isInit) {
    return
  }
  const $root = $(habrSelectors.listComments).first()
  const scoreCounts = {}
  const topComments = parseContentList($root, scoreCounts)
  if (!topComments.length) {
    return
  }
  isInit = true
  clearInterval(intervalId)
  appendScores(topComments, scoreCounts)
}

type CommentTree = {
  $comment: JQuery
  score: number
  children: CommentTree[]
}

function getScore(text: string | undefined) {
  if (!text) return 0
  const number = /([+-]?\d+)/.exec(text.replace("–", "-"))![1]
  return parseInt(number, 10)
}

function tag(name: string, attrs?: Record<string, any>) {
  return $("<" + name + ">", attrs)
}

function toggleComment($comment: JQuery, visible: boolean) {
  function toggle(selector: string, state: boolean) {
    $comment.find(selector).first().toggleClass(cls.hide, state)
  }

  toggle(habrSelectors.commentMessage, !visible)
  toggle(habrSelectors.commentFooter, !visible)
  toggle(habrSelectors.commentReplayForm, !visible)
  toggle("." + cls.openComment, visible)
}

function addCommentOpenLink($comment: JQuery) {
  const open = tag("a", {
    class: `${cls.openComment} ${cls.hide}`,
    href: "#",
    text: "раскрыть",
  }).css({"margin-left": "10px"})
  open.on("click", function () {
    toggleComment($comment, true)
    return false
  })
  $comment.find(habrSelectors.commentNav).first().after(open)
}

function parseContentList(
  $contentList: JQuery,
  scoreCounts: Record<number, number>,
): CommentTree[] {
  const $items = $contentList.children(habrSelectors.itemComment).toArray()
  return $items.map(function (item) {
    const $comment = $(habrSelectors.comment, item).first()
    addCommentOpenLink($comment)
    const score = getScore($(habrSelectors.score, $comment).text())
    scoreCounts[score] = (scoreCounts[score] || 0) + 1
    const $childrenComments = habrSelectors.nestedCommentsContainer
      ? $(habrSelectors.nestedCommentsContainer, item).first()
      : $(item)
    return {
      $comment,
      score,
      children: parseContentList($childrenComments, scoreCounts),
    }
  })
}

function highlightScores() {
  $(`.${cls.scores} a`).each(function () {
    $(this).toggleClass(
      cls.hightlight,
      currentScore !== undefined && parseInt($(this).text()) >= currentScore,
    )
  })
}

function highlightComments(
  trees: CommentTree[],
  top: boolean,
): {directChildHasGoodScore: boolean; anyChildHasGoodScore: boolean} {
  highlightScores()
  const childrenGoodScores = trees.map((tree) => {
    const goodScore = currentScore === undefined || tree.score >= currentScore
    tree.$comment
      .find(habrSelectors.commentHead)
      .toggleClass(cls.hightlight, currentScore !== undefined && goodScore)

    const childScores = highlightComments(tree.children, false)
    toggleComment(
      tree.$comment,
      goodScore || childScores.directChildHasGoodScore,
    )
    if (top) {
      tree.$comment
        .parent()
        .toggleClass(cls.hide, !(childScores.anyChildHasGoodScore || goodScore))
    }
    return {
      directDhildHasGoodScore: goodScore,
      anyChildHasGoodScore: goodScore || childScores.anyChildHasGoodScore,
    }
  })
  return {
    anyChildHasGoodScore: childrenGoodScores.some(
      (x) => x.anyChildHasGoodScore,
    ),
    directChildHasGoodScore: childrenGoodScores.some(
      (x) => x.directDhildHasGoodScore,
    ),
  }
}

function appendScores(
  topComments: CommentTree[],
  scoreCounts: Record<number, number>,
) {
  function getScoreCls(rating: number) {
    if (rating < 0) return cls.negative
    if (rating === 0) return ""
    return cls.positive
  }

  const $scores = tag("div", {class: cls.scores, text: "Оценки "})
  const scoresSorted = sortBy(toPairs(scoreCounts), (x) => -x[0])

  if (!scoresSorted.length) return

  scoresSorted.forEach(([key, count]) => {
    const score = +key
    const anchor = tag("a", {
      class: `${cls.counter} ${getScoreCls(score)}`,
      href: "#",
      text: score,
    }).css({"padding-right": "2px", "padding-left": "3px"})
    anchor.on("click", function () {
      currentScore = currentScore !== score ? score : undefined
      highlightComments(topComments, true)
      return false
    })
    $scores.append(anchor)
    $scores.append(count > 1 ? "(" + count + ") " : " ")
  })

  $(habrSelectors.commentTitle).append($scores)
}

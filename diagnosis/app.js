import {QUESTIONS, diagnose} from './logic.js';
const $ = id => document.getElementById(id);
// Answers exist only in this module's memory and are never sent or persisted.
let step = 0;
let answers = {};
function renderQuestion(focus = true) {
  const question = QUESTIONS[step];
  $('result-panel').hidden = true;
  $('question-panel').hidden = false;
  $('question-title').textContent = question.title;
  $('question-help').textContent = question.help;
  $('step-label').textContent = `質問 ${step + 1} / ${QUESTIONS.length}`;
  $('progress').value = step + 1;
  $('progress').setAttribute('aria-label', `現在の質問、全4問中${step + 1}問目`);
  $('options').replaceChildren(...question.options.map(option => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio'; input.name = question.id; input.value = option.value;
    input.required = true; input.checked = answers[question.id] === option.value;
    input.setAttribute('aria-describedby', 'question-help');
    const text = document.createElement('span'); text.textContent = option.label;
    input.addEventListener('change', () => {answers[question.id] = input.value; updateNext();});
    label.append(input, text); return label;
  }));
  $('back').disabled = step === 0;
  $('next').textContent = step === QUESTIONS.length - 1 ? '診断結果を見る' : '次へ';
  updateNext();
  if (focus) $('question-title').focus();
}
function updateNext() {
  const question = QUESTIONS[step];
  const valid = question.options.some(o => o.value === answers[question.id]);
  $('next').disabled = !valid;
  $('selection-hint').textContent = valid ? '選び直して回答を修正できます。' : '1つ選択すると次へ進めます。';
}
function showResult() {
  const result = diagnose(answers);
  $('question-panel').hidden = true;
  $('result-panel').hidden = false;
  $('result-intro').textContent = `回答をもとに、取り組みたいことと管理の状況から優先した${result.points.length}件をご紹介します。`;
  $('recommendations').replaceChildren(...result.points.map(point => {
    const li = document.createElement('li'); li.dataset.point = point.id;
    const h3 = document.createElement('h3'); h3.textContent = point.title;
    const reason = document.createElement('p'); reason.className = 'reason'; reason.textContent = point.reason;
    const action = document.createElement('p'); action.className = 'action'; action.textContent = point.action;
    li.append(h3, reason, action); return li;
  }));
  $('channel-note').textContent = result.channelNote;
  $('answer-summary').replaceChildren(...QUESTIONS.flatMap(question => {
    const dt = document.createElement('dt'); dt.textContent = question.title;
    const dd = document.createElement('dd'); dd.textContent = question.options.find(o => o.value === answers[question.id]).label;
    return [dt, dd];
  }));
  $('result-title').focus();
}
$('question-form').addEventListener('submit', event => {
  event.preventDefault();
  if ($('next').disabled) return;
  if (step < QUESTIONS.length - 1) {step++; renderQuestion();}
  else showResult();
});
$('back').addEventListener('click', () => {if (step > 0) {step--; renderQuestion();}});
$('review').addEventListener('click', () => {step = 0; renderQuestion();});
$('restart').addEventListener('click', () => {answers = {}; step = 0; renderQuestion();});
renderQuestion(false);

// Pure diagnosis rules. No storage, network, DOM, or financial calculations.
export const QUESTIONS = [
  {id: 'channel', title: '主な販売チャネルは？', help: '最も近いものを1つ選んでください。', options: [
    {value: 'own', label: 'Shopify・自社EC'}, {value: 'marketplace', label: 'Amazon・楽天など'}, {value: 'multiple', label: '複数チャネル'}]},
  {id: 'sku', title: 'SKU別の利益は把握できていますか？', help: '商品ごとの利益を、どの程度確認できていますか。', options: [
    {value: 'all', label: 'できている'}, {value: 'partial', label: '一部だけ'}, {value: 'none', label: 'できていない'}]},
  {id: 'costs', title: '送料・手数料・広告費は管理していますか？', help: '売上原価以外にかかる費用について教えてください。', options: [
    {value: 'all', label: 'すべて管理'}, {value: 'partial', label: '一部のみ'}, {value: 'none', label: 'ほぼ未管理'}]},
  {id: 'concern', title: '今一番困っていることは？', help: '今、優先して取り組みたいことを1つ選んでください。', options: [
    {value: 'time', label: '集計に時間がかかる'}, {value: 'accuracy', label: '利益が正確に分からない'},
    {value: 'action', label: '何を改善すべきか分からない'}, {value: 'none', label: '特に困っていない'}]},
];
const CHANNEL_ACTION = {
  own: 'Shopify・自社ECの注文CSVから、SKU・数量・販売単価・販売日を確認しましょう。',
  marketplace: '各モールの注文・精算レポートを確認し、売上と手数料を分けて整理しましょう。',
  multiple: 'チャネル間でSKU表記・対象期間・金額の扱いをそろえ、同じ注文の二重計上を防ぎましょう。',
};
export function diagnose(answers) {
  if (!answers || QUESTIONS.some(q => !q.options.some(o => o.value === answers[q.id]))) {
    throw new Error('4問すべてに、有効な選択肢で回答してください。');
  }
  const candidates = [];
  const add = (id, priority, title, reason, action) => candidates.push({id, priority, title, reason, action});
  if (answers.sku !== 'all') add('sku', answers.sku === 'none' ? 85 : 65,
    'SKU別の利益管理を整える',
    answers.sku === 'none' ? 'SKU別の利益をまだ把握できていないという回答でした。' : 'SKU別の利益の把握が一部にとどまっているという回答でした。',
    'まず主力商品から、SKU・販売数量・販売単価・1個あたりの仕入原価をそろえ、粗利益額と粗利益率を確認しましょう。');
  if (answers.costs !== 'all') add('costs', answers.costs === 'none' ? 90 : 70,
    '送料・手数料・広告費を整理する',
    answers.costs === 'none' ? '売上原価以外の費用は、ほぼ未管理という回答でした。' : '送料・手数料・広告費の管理が一部のみという回答でした。',
    '対象月をそろえ、送料・販売手数料・広告費を費目別に一覧化しましょう。SKUに直接ひも付く費用と共通費を分け、共通費の配分方法を決めるのが次の一歩です。');
  if (answers.concern === 'time') add('csv', 100, 'CSV集計の手順をそろえる',
    '集計に時間がかかることを、今一番の課題として選びました。',
    `毎回使うCSVの列と集計期間を固定し、同じ手順で読み込める形に整えましょう。${CHANNEL_ACTION[answers.channel]}`);
  if (answers.concern === 'accuracy') add('definition', 100, '利益の定義と必要データを確認する',
    '利益が正確に分からないことを、今一番の課題として選びました。',
    '売上から仕入原価を引いた「粗利益」と、さらに送料・手数料・広告費などを引いた利益を分けましょう。税込・税抜、値引き・返品の扱い、原価の対象期間もそろえてください。');
  if (answers.concern === 'action') add('analysis', 100, '利益額と利益率でSKUを見比べる',
    '何を改善すべきか分からないことを、今一番の課題として選びました。',
    '同じ期間でSKUを粗利益額・粗利益率の順に並べ、売上は大きいのに利益が少ない商品を確認しましょう。価格・仕入原価・販売費用を調べ、原因を確かめてから施策を選びます。');
  if (!candidates.length) add('maintain', 0, '今の管理を続け、定期的に確認する',
    'SKU別の利益と各費用を管理できており、特に困っていないという回答でした。',
    '月に一度、SKU別の粗利益額・粗利益率と販売費用の変化を確認しましょう。仕入価格や手数料が変わった際には、管理表の前提も見直してください。');
  const points = candidates.sort((a,b) => b.priority - a.priority).slice(0,3).map(({priority, ...point}) => point);
  return {channelNote: CHANNEL_ACTION[answers.channel], points};
}

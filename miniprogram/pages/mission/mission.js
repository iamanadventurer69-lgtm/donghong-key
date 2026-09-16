/**
 * 第二、三章的 NPC 对话与认证/方案选择题。
 * 只有答对才点亮对应关卡；答错只计数，可以重答。
 */
const content = require('../../data/content');
const store = require('../../utils/storage');

Page({
  data: { mission: null, phase: 'talk', dialogIndex: 0, feedback: '' },
  onLoad(query) {
    const stage = query.stage === '3' ? '3' : '2';
    this.setData({ stage, mission: content.missions[stage] });
  },
  next() {
    const { mission, dialogIndex } = this.data;
    if (dialogIndex + 1 < mission.lines.length) {
      this.setData({ dialogIndex: dialogIndex + 1 });
      return;
    }
    this.setData({ phase: 'quiz' });
  },
  answer(e) {
    const option = this.data.mission.options.find((item) => item.id === e.currentTarget.dataset.id);
    if (option.correct) {
      store.dispatch('missionQuiz', this.data.stage + ':correct');
      this.setData({ phase: 'complete', feedback: this.data.mission.success });
      return;
    }
    store.dispatch('missionQuiz', this.data.stage + ':wrong');
    this.setData({ feedback: '这个选择没有解决本关的真实问题。再试一次。' });
  },
  back() {
    wx.navigateBack({ delta: 1 });
  }
});

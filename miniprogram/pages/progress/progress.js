/**
 * 探索档案：四屏查看本机进度、信任值与画像、文化体系、存档操作。
 * 只读本机数据，不涉及任何身份信息。
 */
const pager = require('../../utils/pager');
const content = require('../../data/content');
const store = require('../../utils/storage');
const state = require('../../utils/state');

/** 任务清单里第一条还没完成的，用来提示「接下来做什么」。 */
function nextTask(s) {
  const task = state.tasks(s).find((item) => !item.done);
  return task ? `接下来：${task.name}` : '全部任务已完成 🏆';
}

/** 各局成绩的简短文案。 */
function scoreText(s) {
  const { flip, crush, quiz } = s.games;
  return {
    flip: flip.done ? `${flip.moves} 步 / ${flip.seconds} 秒` : '未完成',
    crush: crush.done ? `${crush.score} 分` : '未完成',
    quiz: quiz.done
      ? `${quiz.score} 分`
      : quiz.results.length > 0
        ? `进行中 ${quiz.results.length} 题`
        : '未完成'
  };
}

Page({
  ...pager.methods,
  data: {
    panel: 0,
    panelCount: 4,
    culture: content.culture
  },
  onShow() {
    this.sync();
  },
  sync() {
    const s = store.read();
    const portrait = state.portrait(s);
    const taskProgress = state.taskProgress(s);
    this.setData({
      s,
      percent: state.percent(s),
      warning: store.warning(),
      updated: s.updatedAt ? new Date(s.updatedAt).toLocaleString() : '还未开始',
      reward: {
        done: taskProgress.done,
        total: taskProgress.total,
        percent: Math.round((taskProgress.done / taskProgress.total) * 100),
        next: nextTask(s),
        grade: state.allDone(s) ? state.grade(s).code : ''
      },
      scores: scoreText(s),
      trust: s.trust,
      marks: state.MARKS.map((name) => ({ name, value: s.marks[name] || 0 })),
      style: portrait.style,
      level: portrait.level
    });
  },
  resume() {
    wx.navigateTo({ url: state.route(store.read()) });
  },
  /** 保存失败后重试：把内存里的进度再写一次本机存储。 */
  retry() {
    store.write(store.read());
    this.sync();
  },
  reset() {
    wx.showModal({
      title: '重新开启探索？',
      content: '将清除本机的值班记录、信任值与行动承诺，此操作无法撤销。',
      confirmText: '重新开始',
      confirmColor: '#249fdc',
      success: (r) => {
        if (!r.confirm) return;
        store.reset();
        this.sync();
      }
    });
  },
  home() {
    wx.reLaunch({ url: '/pages/home/home' });
  }
});

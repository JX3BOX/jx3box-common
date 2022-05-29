export interface Jx3boxBoss {
  /**
   * Boss唯一标识
   *
   * @type {number}
   * @memberof Jx3boxBoss
   */
  ID: number;
  /**
   * Boss对应成就id
   *
   * @type {number}
   * @memberof Jx3boxBoss
   */
  achievement_id: number;
  /**
   * Boss对应的赛事id
   *
   * @type {number}
   * @memberof Jx3boxBoss
   */
  event_id: number;
  /**
   * Boss名字
   *
   * @type {string}
   * @memberof Jx3boxBoss
   */
  name: string;
}

export interface Jx3boxRankEvent {
  /**
   * 赛事唯一标识
   *
   * @type {number}
   * @memberof Jx3boxRankEvent
   */
  ID: number;
  /**
   * 赛事状态 1进行中 0已结束
   *
   * @type {number}
   * @memberof Jx3boxRankEvent
   */
  status: number;
  superstar: number;
  visible: number;
  visible_game: number;
  /**
   * pc版海报
   *
   * @type {string}
   * @memberof Jx3boxRankEvent
   */
  banner_pc: string;
  /**
   * wx小程序版海报
   *
   * @type {string}
   * @memberof Jx3boxRankEvent
   */
  banner_wxapp: string;
  /**
   * 赛事所有boss列表
   *
   * @type {Array<Jx3boxBoss>}
   * @memberof Jx3boxRankEvent
   */
  boss_map: Array<Jx3boxBoss>;
  /**
   * 赛事对应游戏版本
   *
   * @type {string}
   * @memberof Jx3boxRankEvent
   */
  client: string;
  /**
   * 赛事名称
   *
   * @type {string}
   * @memberof Jx3boxRankEvent
   */
  name: string;
  /**
   * 游戏版本简写
   *
   * @type {string}
   * @memberof Jx3boxRankEvent
   */
  slug: string;
  /**
   * @deprecated
   *
   * @type {string}
   * @memberof Jx3boxRankEvent
   */
  top_team: string;
  /**
   * 投票开始时间
   *
   * @type {string}
   * @memberof Jx3boxRankEvent
   */
  vote_start: string;
  /**
   * 投票结束时间
   *
   * @type {string}
   * @memberof Jx3boxRankEvent
   */
  vote_end: string;
  /**
   * 投票note
   *
   * @type {string}
   * @memberof Jx3boxRankEvent
   */
  vote_note: string;
}

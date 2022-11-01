import { Jx3boxTeam } from "./team";
import { Jx3boxUserinfo } from "./user";

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
  /**
   * 赛事活动的展示权限
   *
   * @type {(Array<
   *     "info" | "rank" | "dps" | "superstar" | "vote" | "video" | "stat"
   *   >)}
   * @memberof Jx3boxRankEvent
   */
  blocks: Array<
    "info" | "rank" | "dps" | "superstar" | "vote" | "video" | "stat" | "lucky"
  >;
  /**
   * 晚会回看内容
   *
   * @type {string}
   * @memberof Jx3boxRankEvent
   */
  gifts?: string;
}

interface IJx3bossRankListBase {
  created: number;
  /**
   * 总伤害
   *
   * @type {number}
   * @memberof Jx3boxRankDpsItem
   */
  damage: number;
  /**
   * 秒伤
   *
   * @type {number}
   * @memberof Jx3boxRankDpsItem
   */
  dps: number;
  /**
   * 战斗时间
   *
   * @type {number}
   * @memberof Jx3boxRankDpsItem
   */
  fight_time: number;
  /**
   * 每秒治疗
   *
   * @type {number}
   * @memberof Jx3boxRankDpsItem
   */
  hps: number;
  /**
   *
   *
   * @type {number}
   * @memberof Jx3boxRankDpsItem
   */
  therapy: number;
  /**
   * 所属用户id
   *
   * @type {number}
   * @memberof Jx3boxRankDpsItem
   */
  uid: number;
  /**
   * 体型
   *
   * @type {string}
   * @memberof Jx3boxRankDpsItem
   */
  body_type: string;
  /**
   * 指挥
   *
   * @type {string}
   * @memberof Jx3boxRankDpsItem
   */
  leader: string;
  /**
   * 角色名称
   *
   * @type {string}
   * @memberof Jx3boxRankDpsItem
   */
  role: string;
  /**
   * 所属服务器
   *
   * @type {string}
   * @memberof Jx3boxRankDpsItem
   */
  server: string;
  /**
   *
   *
   * @type {string}
   * @memberof Jx3boxRankDpsItem
   */
  teammate: string;
}

export interface Jx3boxRankTopListItem extends IJx3bossRankListBase {
  ID: number;
  /**
   * 赛事id
   *
   * @type {number}
   * @memberof Jx3boxRankTeamListItem
   */
  achieve_id: number;
  /**
   * 推倒时间
   *
   * @type {number}
   * @memberof Jx3boxRankTeamListItem
   */
  finish_time: number;
  start_time: number;
  superstar: number;
  superstar_type: number;
  team_id: number;
  /**
   * 是否认证
   *
   * @type {number}
   * @memberof Jx3boxRankTeamListItem
   */
  verified: number;
  re_guid: number;
  re_ip: number;
  re_uid: number;
  might_superstar: number;
  battleId: string;
  date_str: string;
  guid: string;
  lang: string;
  mount: string;
  remark: string;
  team_logo: string;
  team_name: string;
  is_leader: boolean;
}

export interface Jx3boxRankMixDpsItem {
  created: number;
  damage: number;
  dps: number;
  fight_time: number;
  hps: number;
  therapy: number;
  uid: number;
  body_type: string;
  leader: string;
  role: string;
  server: string;
  teammate: string;
  team_id: number;
  mount: string;
  team_info: Pick<Jx3boxTeam, "name" | "logo">;
  user_info: Pick<Jx3boxUserinfo, "display_name" | "user_avatar">;
}

export interface Jx3boxRankDpsItem extends IJx3bossRankListBase {
  team_id: number;
  mount: string;
  team_info: Pick<Jx3boxTeam, "name" | "logo">;
  user_info: Pick<Jx3boxUserinfo, "display_name" | "user_avatar">;
}

export interface Jx3boxRankVoteTeamListItem {
  ID: number;
  count: number;
  event_id: number;
  guess: number;
  guess_no_game_role: number;
  status: number;
  team_id: number;
  uid: number;
  votes: number;
  client: string;
  created_at: string;
  leader: string;
  logo: string;
  name: string;
  prize: string;
  server: string;
  slogan: string;
  updated_at: string;
}

export type Jx3boxRankTeamListItem = Jx3boxRankTopListItem;

export type Jx3boxRankBossProcess = {
  [key: number]: number;
};

/**
 * @number 服务器数量
 * @string 服务器名称
 * @type {Jx3boxServerAnalysisItem}
 */
type Jx3boxServerAnalysisItem = [number, string];

interface Jx3boxBarServerAnalysis {
  data: Array<Jx3boxServerAnalysisItem>;
  /**
   * 服务器列表
   *
   * @type {Array<string>}
   * @memberof Jx3boxBarServerAnalysis
   */
  servers: Array<string>;
}

export interface Jx3boxAnalysisBar {
  [name: string]: Jx3boxBarServerAnalysis;
}

interface Jx3boxAnalysisPieItem {
  name: string;
  value: number;
}

export interface Jx3boxAnalysisPie {
  [name: string]: Array<Jx3boxAnalysisPieItem>;
}

export interface Jx3boxAnalysis {
  bar_server_all: Jx3boxAnalysisBar;
  bar_server_top10: Jx3boxAnalysisBar;
  pie_dps_xf_ratio: Jx3boxAnalysisPie;
  pie_hps_count: Jx3boxAnalysisPie;
  pie_hps_xf_ratio: Jx3boxAnalysisPie;
  pie_leader_type_ratio: Jx3boxAnalysisPie;
  pie_neiwaigong_ratio: Jx3boxAnalysisPie;
  pie_school_ratio: Jx3boxAnalysisPie;
  pie_tank_count: Jx3boxAnalysisPie;
  pie_tank_xf_ratio: Jx3boxAnalysisPie;
  pie_xf_ratio: Jx3boxAnalysisPie;
}

export interface Jx3boxAnalysisRow<AnalysisItemType = string> {
  [key: string]: Jx3boxAnalysisRowItem<AnalysisItemType>;
}

export interface Jx3boxAnalysisRowItem<AnalysisItemType> {
  item: Array<AnalysisItemType>;
  value: Array<number>;
}
export interface Jx3boxAnalysisV2 {
  dps_count: Jx3boxAnalysisRow<number>;
  flight_time_mean: Jx3boxAnalysisRow<number>;
  force_attendance_count: Jx3boxAnalysisRow<number>;
  hps_attendance_count: Jx3boxAnalysisRow<number>;
  hps_count: Jx3boxAnalysisRow<number>;
  mount_attendance_count: Jx3boxAnalysisRow<number>;
  rank_mount_damage: Jx3boxAnalysisRow<number>;
  rank_mount_dps: Jx3boxAnalysisRow<number>;
  rank_mount_hps: Jx3boxAnalysisRow<number>;
  rank_mount_therapy: Jx3boxAnalysisRow<number>;
  tank_attendance_count: Jx3boxAnalysisRow<number>;
  tank_count: Jx3boxAnalysisRow<number>;
  leader_mount_type_count: Jx3boxAnalysisRow;
  mount_type_attendance_count: Jx3boxAnalysisRow;
  server_rank_team_count: Jx3boxAnalysisRow;
  top10_achieve_team_count: Jx3boxAnalysisRow;
  top100_achieve_team_count: Jx3boxAnalysisRow;
}

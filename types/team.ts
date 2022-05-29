import { Jx3boxRelation, Jx3boxRole } from "./role";
import { Jx3boxUserinfo } from "./user";

export interface Jx3boxMedal {
  /**
   * 荣誉唯一标识
   *
   * @type {number}
   * @memberof Jx3boxTeamMedal
   */
  id: number;
  /**
   * 荣誉所属竞速活动id
   *
   * @type {number}
   * @memberof Jx3boxTeamMedal
   */
  rank_id: number;
  /**
   * 荣誉所属团队id
   *
   * @type {number}
   * @memberof Jx3boxMedal
   */
  team_id: number;
  /**
   * 荣誉icon id用于拼接
   *
   * @type {string}
   * @memberof Jx3boxMedal
   */
  icon: string;
  /**
   * 荣誉名称
   *
   * @type {string}
   * @memberof Jx3boxMedal
   */
  name: string;
  color: string;
  created_at: string;
}

export interface Jx3boxTeam {
  /**
   * 团队唯一标识
   *
   * @type {number}
   * @memberof Jx3boxTeam
   */
  ID: number;
  assessor: number;
  /**
   * 团队状态s
   *
   * @type {number}
   * @memberof Jx3boxTeam
   */
  status: number;
  /**
   * 创始人用户id
   *
   * @type {number}
   * @memberof Jx3boxTeam
   */
  super: number;
  /**
   * 团队活动可见性
   *
   * @type {number}
   * @memberof Jx3boxTeam
   */
  v_activity: number;
  /**
   * 团队留言板可见性
   *
   * @type {number}
   * @memberof Jx3boxTeam
   */
  v_comment: number;
  /**
   * 团队DKP可见性
   *
   * @type {number}
   * @memberof Jx3boxTeam
   */
  v_dkp: number;
  /**
   * 团队成员可见性
   *
   * @type {number}
   * @memberof Jx3boxTeam
   */
  v_member: number;
  /**
   * 团队海报
   *
   * @type {string}
   * @memberof Jx3boxTeam
   */
  banner: string;
  /**
   * 团队所属版本
   *
   * @type {string}
   * @memberof Jx3boxTeam
   */
  client: string;
  /**
   * 团队详情
   *
   * @type {string}
   * @memberof Jx3boxTeam
   */
  desc: string;
  /**
   * 招募信息
   *
   * @type {string}
   * @memberof Jx3boxTeam
   */
  recruit?: string;
  found: string;
  /**
   * 团队logo
   *
   * @type {string}
   * @memberof Jx3boxTeam
   */
  logo: string;
  medals?: Array<Jx3boxMedal>;
  /**
   * 团队名称
   *
   * @type {string}
   * @memberof Jx3boxTeam
   */
  name: string;
  /**
   * 团队qq群
   *
   * @type {string}
   * @memberof Jx3boxTeam
   */
  qq_group: string;
  /**
   * 团队所属服务器
   *
   * @type {string}
   * @memberof Jx3boxTeam
   */
  server: string;
  tags: Array<string>;
  time: string;
  /**
   * 直播房间号
   *
   * @type {string}
   * @memberof Jx3boxTeam
   */
  tv: string;
  /**
   * 直播平台
   *
   * @type {string}
   * @memberof Jx3boxTeam
   */
  tv_type: string;
  updated_at: string;
  wiki: string;
  /**
   * 团队yy频道
   *
   * @type {string}
   * @memberof Jx3boxTeam
   */
  yy_channel: string;
  /**
   * 团队荣誉
   * @deprecated
   *
   * @type {Array<string>}
   * @memberof Jx3boxTeam
   */
  honors?: Array<string>;
  /**
   * 团队创始人信息
   * @deprecated
   *
   * @type {null}
   * @memberof Jx3boxTeam
   */
  super_info?: Object;
  created_at: string;
}

export interface Jx3boxTeamHonor {
  /**
   * 团队荣誉详情
   *
   * @type {string}
   * @memberof Jx3boxTeamHonor
   */
  honor: string;
  /**
   * 荣誉对应的成就id
   *
   * @type {number}
   * @memberof Jx3boxTeamHonor
   */
  achieve_id: number;
  /**
   * 荣誉对应的赛事id
   *
   * @type {number}
   * @memberof Jx3boxTeamHonor
   */
  event_id: number;
  /**
   * 荣誉唯一标识
   *
   * @type {number}
   * @memberof Jx3boxTeamHonor
   */
  id: number;
  /**
   * 荣誉排名
   *
   * @type {number}
   * @memberof Jx3boxTeamHonor
   */
  ranking: number;
  /**
   * 荣誉对应的团队id
   *
   * @type {number}
   * @memberof Jx3boxTeamHonor
   */
  team_id: number;
  /**
   * 荣誉年份
   *
   * @type {number}
   * @memberof Jx3boxTeamHonor
   */
  year: number;
  created_at: string;
  updated_at: string;
}

export interface Jx3boxTeamMember {
  relation: Jx3boxRelation;
  roles: Jx3boxRole;
}

export interface Jx3boxTeamAuthority {
  /**
   * 权限 authority=99创始人
   *
   * @type {number}
   * @memberof Jx3boxTeamAuthority
   */
  authority: number;
  /**
   * 权限唯一标识
   *
   * @type {number}
   * @memberof Jx3boxTeamAuthority
   */
  id: number;
  /**
   * 审核权限
   *
   * @type {number}
   * @memberof Jx3boxTeamAuthority
   */
  r_audit: number;
  /**
   * dkp权限
   *
   * @type {number}
   * @memberof Jx3boxTeamAuthority
   */
  r_dkp: number;
  /**
   * 删除权限
   *
   * @type {number}
   * @memberof Jx3boxTeamAuthority
   */
  r_drop: number;
  /**
   * 成员权限
   *
   * @type {number}
   * @memberof Jx3boxTeamAuthority
   */
  r_member: number;
  r_plan: number;
  /**
   * 活动权限
   *
   * @type {number}
   * @memberof Jx3boxTeamAuthority
   */
  r_raid: number;
  r_snapshot: number;
  /**
   * 对应团队id
   *
   * @type {number}
   * @memberof Jx3boxTeamAuthority
   */
  team_id: number;
  /**
   * 请求权限用户id
   *
   * @type {number}
   * @memberof Jx3boxTeamAuthority
   */
  user_id: number;
  updated_at: string;
  created_at: string;
}

export interface Jx3boxTeamDetail extends Jx3boxTeam {
  super_info: Pick<Jx3boxUserinfo, "display_name" | "user_avatar">;
}

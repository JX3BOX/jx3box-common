import { Jx3boxTeam } from "./team";
import { Jx3boxUserinfo } from "./user";

export interface Jx3boxRaid {
  /**
   * 活动权限
   *
   * @type {number}
   * @memberof Jx3boxRaid
   */
  auth: number;
  /**
   * 是否自动通过请求
   *
   * @type {number}
   * @memberof Jx3boxRaid
   */
  auto_accept: number;
  /**
   * 活动满编人数
   *
   * @type {number}
   * @memberof Jx3boxRaid
   */
  count: number;
  /**
   * 强制匹配?
   *
   * @type {number}
   * @memberof Jx3boxRaid
   */
  force_match: number;
  /**
   * 活动唯一标识
   *
   * @type {number}
   * @memberof Jx3boxRaid
   */
  id: number;
  /**
   * 是否是公开活动
   *
   * @type {number}
   * @memberof Jx3boxRaid
   */
  is_public: number;
  /**
   * 是否置顶 1置顶 0未置顶
   *
   * @type {number}
   * @memberof Jx3boxRaid
   */
  sticky: number;
  /**
   * 活动所属团队id
   *
   * @type {number}
   * @memberof Jx3boxRaid
   */
  team_id: number;
  /**
   * pc版创建活动时行列信息
   *
   * @type {number}
   * @memberof Jx3boxRaid
   */
  row: number;
  col: number;
  /**
   * 创建人id
   *
   * @type {number}
   * @memberof Jx3boxRaid
   */
  user_id: number;
  /**
   * 活动所属版本
   *
   * @type {string}
   * @memberof Jx3boxRaid
   */
  client: string;
  /**
   * 活动详情
   *
   * @type {string}
   * @memberof Jx3boxRaid
   */
  desc: string;
  /**
   * 活动开始时间
   *
   * @type {string}
   * @memberof Jx3boxRaid
   */
  start_time: string;
  /**
   * 活动指挥
   *
   * @type {string}
   * @memberof Jx3boxRaid
   */
  leader: string;
  /**
   * 活动名字
   *
   * @type {string}
   * @memberof Jx3boxRaid
   */
  name: string;
  /**
   * 活动所属服务器
   *
   * @type {string}
   * @memberof Jx3boxRaid
   */
  server: string;
  /**
   * 活动所属团队logo
   *
   * @type {string}
   * @memberof Jx3boxRaid
   */
  team_logo: string;
  /**
   * 活动所属团队名字
   *
   * @type {string}
   * @memberof Jx3boxRaid
   */
  team_name: string;
  /**
   * 活动自定义标题
   *
   * @type {string}
   * @memberof Jx3boxRaid
   */
  title: string;
  /**
   * 最后修改人员的id
   *
   * @type {number}
   * @memberof Jx3boxRaid
   */
  last_edit?: number;
  /**
   * 活动时间相关
   *
   * @type {string}
   * @memberof Jx3boxRaid
   */
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Jx3boxRaidMember {
  /**
   * 活动成员唯一标识
   *
   * @type {number}
   * @memberof Jx3boxRaidMember
   */
  id: number;
  is_member_request: number;
  /**
   * 是否是正式成员 is_valid=1正式 is_valid=0占位
   *
   * @type {number}
   * @memberof Jx3boxRaidMember
   */
  is_valid: number;
  /**
   * 活动成员心法
   *
   * @type {number}
   * @memberof Jx3boxRaidMember
   */
  mount: number;
  /**
   * 活动成员排序
   *
   * @type {number}
   * @memberof Jx3boxRaidMember
   */
  order: number;
  /**
   * 对应活动id
   *
   * @type {number}
   * @memberof Jx3boxRaidMember
   */
  raid_id: number;
  /**
   * 对应角色id
   *
   * @type {number}
   * @memberof Jx3boxRaidMember
   */
  role_id: number;
  /**
   * 对应团队id
   *
   * @type {number}
   * @memberof Jx3boxRaidMember
   */
  team_id: number;
  /**
   * 对应用户id
   *
   * @type {number}
   * @memberof Jx3boxRaidMember
   */
  user_id: number;
  /**
   * 活动成员名称
   *
   * @type {string}
   * @memberof Jx3boxRaidMember
   */
  name: string;
  /**
   * 活动成员备注
   *
   * @type {string}
   * @memberof Jx3boxRaidMember
   */
  remark: string;
  /**
   *
   *
   * @type {string}
   * @memberof Jx3boxRaidMember
   */
  server: string;
  /**
   * 活动成员展示信息
   *
   * @type {{
   *     display_name: string;
   *     user_avatar: string;
   *   }}
   * @memberof Jx3boxRaidMember
   */
  raid_member_info: {
    display_name: string;
    user_avatar: string;
  };
  /**
   * 活动成员类型
   *
   * @type {('normal' | 'sub' | 'tobe')}
   * @memberof Jx3boxRaidMember
   */
  type: "normal" | "sub" | "tobe";
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Jx3boxRaidDetail extends Jx3boxRaid {
  team_info: Pick<Jx3boxTeam, "ID" | "banner" | "logo" | "name" | "status">;
}

export interface Jx3boxJoinRaid {
  /**
   * 参加活动的唯一标识
   *
   * @type {number}
   * @memberof Jx3boxJoinRaid
   */
  id: number;
  is_member_request: number;
  /**
   * 是否验证 1验证 0未验证
   *
   * @type {number}
   * @memberof Jx3boxJoinRaid
   */
  is_valid: number;
  mount: number;
  /**
   * 排序规则
   *
   * @type {number}
   * @memberof Jx3boxJoinRaid
   */
  order: number;
  /**
   * 活动id
   *
   * @type {number}
   * @memberof Jx3boxJoinRaid
   */
  raid_id: number;
  /**
   * 所属团队id
   *
   * @type {number}
   * @memberof Jx3boxJoinRaid
   */
  team_id: number;
  /**
   * 创建活动人id
   *
   * @type {number}
   * @memberof Jx3boxJoinRaid
   */
  user_id: number;
  name: string;
  remark: string;
  server: string;
  type: string;
  role_id?: number;
  raid_info: Jx3boxRaid;
  raid_team_info: Jx3boxTeam;
  updated_at: string;
  created_at: string;
  deleted_at: string;
}

export interface Jx3boxPresetRaid {
  /**
   * 预设活动id
   *
   * @type {number}
   * @memberof Jx3boxPresetRaid
   */
  id: number;
  /**
   * 预设活动名称
   *
   * @type {string}
   * @memberof Jx3boxPresetRaid
   */
  name: string;
  map_id: number;
  col: number;
  row: number;
  count: number;
}

/**
 * 修改活动的权限人员类型
 *
 * @type {Jx3boxRaidManageAdmin}
 */
type Jx3boxRaidManageAdmin = Pick<
  Jx3boxUserinfo,
  "ID" | "display_name" | "user_avatar" | "user_avatar_frame"
>;
export interface Jx3boxRaidManage extends Jx3boxRaid {
  raid_creator_info: Jx3boxRaidManageAdmin;
  raid_editor_info?: Jx3boxRaidManageAdmin;
}

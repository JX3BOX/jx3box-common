## Role

```typescript
export interface Jx3boxRole {
  /**
   * 角色唯一标识
   *
   * @type {number}
   * @memberof Jx3boxRole
   */
  ID: number;
  /**
   * 角色状态
   *
   * @type {number}
   * @memberof Jx3boxRole
   */
  status: number;
  /**
   * 角色对应用户id
   *
   * @type {number}
   * @memberof Jx3boxRole
   */
  uid: number;
  /**
   * 角色优先级
   *
   * @type {number}
   * @memberof Jx3boxRole
   */
  priority: number;
  /**
   * 角色是否为自定义 1自定义 0从游戏绑定
   *
   * @type {number}
   * @memberof Jx3boxRole
   */
  custom: number;
  /**
   * 角色体型
   *
   * @type {string}
   * @memberof Jx3boxRole
   */
  body_type: string;
  /**
   * 角色心法
   *
   * @type {string}
   * @memberof Jx3boxRole
   */
  mount: string;
  /**
   * 角色名称
   *
   * @type {string}
   * @memberof Jx3boxRole
   */
  name: string;
  /**
   * 角色备注
   *
   * @type {string}
   * @memberof Jx3boxRole
   */
  note: string;
  /**
   * 角色所属服务器
   *
   * @type {string}
   * @memberof Jx3boxRole
   */
  server: string;
  player_id: string;
  created_at: string;
}

export interface Jx3boxRelation {
  /**
   * 角色备注
   *
   * @type {string}
   * @memberof Jx3boxTeamRelation
   */
  role_remark: string;
  /**
   * 团队备注
   *
   * @type {string}
   * @memberof Jx3boxTeamRelation
   */
  team_remark: string;
  /**
   * 关系唯一标识
   *
   * @type {number}
   * @memberof Jx3boxTeamRelation
   */
  ID: number;
  assessor: number;
  /**
   * 是否删除
   *
   * @type {number}
   * @memberof Jx3boxTeamRelation
   */
  has_deleted: number;
  /**
   * 是否公开 1公开 0未公开
   *
   * @type {number}
   * @memberof Jx3boxTeamRelation
   */
  public: number;
  /**
   * 对应角色id
   *
   * @type {number}
   * @memberof Jx3boxTeamRelation
   */
  role_id: number;
  star: number;
  /**
   * 状态
   *
   * @type {number}
   * @memberof Jx3boxTeamRelation
   */
  status: number;
  /**
   * 对应团队id
   *
   * @type {number}
   * @memberof Jx3boxTeamRelation
   */
  team_id: number;
  /**
   * 对应用户id
   *
   * @type {number}
   * @memberof Jx3boxTeamRelation
   */
  uid: number;
  updated_at: string;
  created_at: string;
  deleted_at: string;
}
```

## User

```typescript
export interface Jx3boxUserinfo {
  /**
   * 用户唯一标识
   *
   * @type {number}
   * @memberof Jx3boxUserinfo
   */
  ID: number;
  /**
   * 用户是否删除
   *
   * @type {number}
   * @memberof Jx3boxUserinfo
   */
  deleted: number;
  /**
   * 用户昵称
   *
   * @type {string}
   * @memberof Jx3boxUserinfo
   */
  display_name: string;
  /**
   * 用户等级经验
   *
   * @type {number}
   * @memberof Jx3boxUserinfo
   */
  experience: number;
  /**
   * github 研发相关
   *
   * @type {number}
   * @memberof Jx3boxUserinfo
   */
  github_id?: number;
  github_name?: string;
  /**
   * 是否是PRE用户
   *
   * @type {string}
   * @memberof Jx3boxUserinfo
   */
  is_pre: boolean;
  /**
   * 是否是PRO用户
   *
   * @type {boolean}
   * @memberof Jx3boxUserinfo
   */
  is_pro: boolean;
  /**
   * 玩家所属服务器
   *
   * @type {string}
   * @memberof Jx3boxUserinfo
   */
  jx3_server?: string;
  /**
   *
   *
   * @type {number}
   * @memberof Jx3boxUserinfo
   */
  sign: number;
  /**
   * 绑定的推栏id
   *
   * @type {number}
   * @memberof Jx3boxUserinfo
   */
  tuilan_id?: number;
  /**
   * 直播房间号
   *
   * @type {string}
   * @memberof Jx3boxUserinfo
   */
  tv_id?: string;
  /**
   * 直播平台
   *
   * @type {string}
   * @memberof Jx3boxUserinfo
   */
  tv_type?: string;
  /**
   * 用户头像
   *
   * @type {string}
   * @memberof Jx3boxUserinfo
   */
  user_avatar: string;
  user_avatar_frame?: string;
  user_bio?: number;
  user_group: number;
  /**
   * 用户注册时间
   *
   * @type {string}
   * @memberof Jx3boxUserinfo
   */
  user_registered: string;
  /**
   * 用户状态
   *
   * @type {number}
   * @memberof Jx3boxUserinfo
   */
  user_status: number;
  /**
   * 验证邮箱
   *
   * @type {number}
   * @memberof Jx3boxUserinfo
   */
  verify_email: number;
  /**
   * 验证手机
   *
   * @type {number}
   * @memberof Jx3boxUserinfo
   */
  verify_phone: number;
  /**
   * 绑定微博账号id
   *
   * @type {number}
   * @memberof Jx3boxUserinfo
   */
  weibo_id?: number;
  /**
   * 绑定微博账号名称
   *
   * @type {string}
   * @memberof Jx3boxUserinfo
   */
  weibo_name?: string;
}

export interface Jx3boxMessage {
  /**
   * 消息唯一标识
   *
   * @type {number}
   * @memberof Jx3boxMessage
   */
  ID: number;
  /**
   * 消息内容
   *
   * @type {"加入诗画印象团队的申请已 通过加入"}
   * @memberof Jx3boxMessage
   */
  content: string;
  /**
   * 创建时间戳
   *
   * @type {string}
   * @memberof Jx3boxMessage
   */
  created: string;
  /**
   * 消息是否删除
   *
   * @type {number}
   * @memberof Jx3boxMessage
   */
  deleted: number;
  /**
   * 消息是否已读 0未读 1已读
   *
   * @type {number}
   * @memberof Jx3boxMessage
   */
  read: number;
  /**
   * 消息跳转对应的参数id
   *
   * @type {string}
   * @memberof Jx3boxMessage
   */
  source_id: string;
  /**
   * 消息跳转对应的类型
   *
   * @type {string}
   * @memberof Jx3boxMessage
   */
  source_type: string;
  /**
   * 消息子类型
   *
   * @type {string}
   * @memberof Jx3boxMessage
   */
  subtype: string;
  /**
   * 消息类型
   *
   * @type {string}
   * @memberof Jx3boxMessage
   */
  type: string;
  updated: string;
  /**
   * 消息所属用户id
   *
   * @type {number}
   * @memberof Jx3boxMessage
   */
  user_id: number;
}
```

## Rank

```typescript
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

```

## Raid 

```typescript

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

```

## Team

```typescript

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

```
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

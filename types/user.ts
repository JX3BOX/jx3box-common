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

type Jx3boxNullableAttr<T> = T | null;

export interface Jx3boxSkill {
  //魔盒数据库唯一辨识ID
  IdKey: number;
  //技能ID
  SkillID: number;
  //等级
  Level: number;
  //图标ID
  IconID: number;
  Show: number;
  CombatShow: number;
  Formation: number;
  FormationCaster: number;
  PracticeID: number;
  SortOrder: number;
  Remark: string;
  Name: string;
  Desc: string;
  ShortDesc: Jx3boxNullableAttr<string>;
  SpecialDesc: string;
  KungfuDesc: Jx3boxNullableAttr<string>;
  HelpDesc: string;
  IsShowInNewSkill: string;
  CanDrag: string;
  SkillRelyOnShow: Jx3boxNullableAttr<string>;
  SkillRelyOnNotShow: Jx3boxNullableAttr<string>;
  IsShowNotLearn: string;
  IsHotkeyExitWhenForget: Jx3boxNullableAttr<string>;
  Buff: Jx3boxNullableAttr<string>;
  Debuff: Jx3boxNullableAttr<string>;
  BlackList: Jx3boxNullableAttr<string>;
  SimpleDesc: string;
  AutoSelectTarget: "0";
  Decoration: Jx3boxNullableAttr<string>;
  SkillName: string;
  Design_Belong: string;
  Design_Effect: string;
  MaxLevel: string;
  KindType: string;
  FunctionType: string;
  UIType: string;
  BelongKungfu: string;
  BelongSchool: string;
  CastMode: string;
  WeaponRequest: string;
  IsCostAmmo: string;
  CostItemType: string;
  CostItemIndex: string;
  MountRequestType: string;
  MountRequestDetail: string;
  MountType: string;
  IsMountAble: string;
  IsPassiveSkill: string;
  IsChannelSkill: string;
  IsExpSkill: string;
  IsExactHit: string;
  IsInstinct: string;
  IsAutoTurn: string;
  CauseAbradeEquipment: string;
  CauseBeatBreak: string;
  CauseBeatBack: string;
  hasCriticalStrike: Jx3boxNullableAttr<string>;
  SkillEventMask1: string;
  SkillEventMask2: string;
  SkillCastFlag: string;
  UseCastScript: string;
  Use3DObstacle: string;
  CheckReachable: string;
  IgnorePositiveShield: string;
  IgnoreNegativeShield: string;
  NeedOutOfFight: string;
  SelfOnFear: string;
  SelfHorseStateRequest: string;
  TargetTypePlayer: string;
  TargetTypeNpc: string;
  TargetRelationNone: string;
  TargetRelationSelf: string;
  TargetRelationAlly: string;
  TargetRelationEnemy: string;
  TargetRelationDialog: string;
  TargetRelationNeutrality: string;
  TargetRelationParty: string;
  TargetRelationRaid: string;
  TargetHorseStateRequest: string;
  TargetOnFear: string;
  NPCWeaponType: string;
  CommonSkillActiveMode: string;
  IsBindCombatTag: string;
  EffectPlayType: string;
  ScriptFile: string;
  _ScriptFileHashID: Jx3boxNullableAttr<string>;
  EffectType: string;
  CheckBindBuff: string;
  MountRequestDetailLevel: string;
  CastMask: string;
  SelfMoveStateMask: string;
  TargetMoveStateMask: string;
  RecipeType: string;
  MapBanMask: string;
  SkillMark: string;
  SelfBackupMoveStateMask: string;
  TargetRelationMentor: string;
  TargetRelationApprentice: string;
  KungfuMountID: string;
  HorseMask: string;
  PetTemplateID: string;
  TargetNpcSpeciesMask: Jx3boxNullableAttr<string>;
  SelfSprintStateRequest: string;
  SelfTerrainStateRequest: string;
  SelfFollowStateRequest: Jx3boxNullableAttr<string>;
  IgnoreCamp: Jx3boxNullableAttr<string>;
  TargetFollowStateRequest: Jx3boxNullableAttr<string>;
  IsCheckStealth: string;
  SelfMoveStateMask2: string;
  SelfBackupMoveStateMask2: string;
  TargetMoveStateMask2: string;
  Pos: Jx3boxNullableAttr<string>;
  CanReverse: string;
  CanCastOnTower: string;
  TargetRelationTeamGroup: Jx3boxNullableAttr<string>;
  TargetJumpCountMask: Jx3boxNullableAttr<string>;
  UseEarlyWarningScript: Jx3boxNullableAttr<string>;
  TargetFollowTypeRequest: string;
  IgnoreSilence: Jx3boxNullableAttr<string>;
  LongRange: Jx3boxNullableAttr<string>;
  AOE: Jx3boxNullableAttr<string>;
  AbradeEquipRate: Jx3boxNullableAttr<string>;
  UseSkillCoefficient: string;
  IsMentalPassiveSkill: Jx3boxNullableAttr<string>;
}

export interface Jx3boxTalentConfigCode {
  sq: string;
  xf: string;
  version: string;
}

export interface Jx3boxTalentConfigPZCode {
  id: number;
  icon: number;
  name: string;
}

export interface Jx3boxTalentConfig {
  id: number;
  user_id: number;
  client: string;
  type: string;
  mount: number;
  version: string;
  name: string;
  code: Jx3boxTalentConfigCode;
  pzcode: Jx3boxTalentConfigPZCode[];
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

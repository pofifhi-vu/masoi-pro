import { RoleDef } from '../types/game';

export const ALL_ROLES: RoleDef[] = [
  // Phe Dân làng
  {
    key: 'DAN_LANG',
    name: 'Dân làng',
    faction: 'VILLAGER',
    factionLabel: 'Phe Dân làng',
    description: 'Không có chức năng',
    iconName: 'User',
    defaultCount: 0
  },
  {
    key: 'TIEN_TRI',
    name: 'Tiên tri',
    faction: 'VILLAGER',
    factionLabel: 'Phe Dân làng',
    description: 'Soi một người mỗi đêm',
    iconName: 'Eye',
    defaultCount: 0
  },
  {
    key: 'BAO_VE',
    name: 'Bảo vệ',
    faction: 'VILLAGER',
    factionLabel: 'Phe Dân làng',
    description: 'Bảo vệ 1 người',
    iconName: 'Shield',
    defaultCount: 0
  },
  {
    key: 'PHU_THUY',
    name: 'Phù thủy',
    faction: 'VILLAGER',
    factionLabel: 'Phe Dân làng',
    description: '2 bình thuốc (cứu & giết)',
    iconName: 'FlaskConical',
    defaultCount: 0
  },
  {
    key: 'THO_SAN',
    name: 'Thợ săn',
    faction: 'VILLAGER',
    factionLabel: 'Phe Dân làng',
    description: 'Kéo theo 1 người khi chết',
    iconName: 'Zap',
    defaultCount: 0
  },
  {
    key: 'GIA_LANG',
    name: 'Già làng',
    faction: 'VILLAGER',
    factionLabel: 'Phe Dân làng',
    description: '2 mạng vào đêm',
    iconName: 'Accessibility',
    defaultCount: 0
  },
  {
    key: 'THAN_TINH_YEU',
    name: 'Thần tình yêu',
    faction: 'VILLAGER',
    factionLabel: 'Phe Dân làng',
    description: 'Ghép đôi 2 người',
    iconName: 'Heart',
    defaultCount: 0
  },
  {
    key: 'PHAP_SU_CAM_LANG',
    name: 'Pháp sư câm lặng',
    faction: 'VILLAGER',
    factionLabel: 'Phe Dân làng',
    description: 'Cấm nói 1 người',
    iconName: 'MicOff',
    defaultCount: 0
  },

  // Phe Sói
  {
    key: 'MA_SOI',
    name: 'Ma Sói',
    faction: 'WEREWOLF',
    factionLabel: 'Phe Sói',
    description: 'Cắn người hàng đêm',
    iconName: 'PawPrint',
    defaultCount: 0
  },
  {
    key: 'SOI_TIEN_TRI',
    name: 'Sói tiên tri',
    faction: 'WEREWOLF',
    factionLabel: 'Phe Sói',
    description: 'Soi vai trò hàng đêm',
    iconName: 'Search',
    defaultCount: 0
  },
  {
    key: 'SOI_CAM_LANG',
    name: 'Sói câm lặng',
    faction: 'WEREWOLF',
    factionLabel: 'Phe Sói',
    description: 'Khóa mồm 1 người',
    iconName: 'VolumeX',
    defaultCount: 0
  },
  {
    key: 'SOI_CON',
    name: 'Sói con',
    faction: 'WEREWOLF',
    factionLabel: 'Phe Sói',
    description: 'Chết sói cắn đôi',
    iconName: 'Smile',
    defaultCount: 0
  },

  // Phe Thứ Ba & Khác
  {
    key: 'KE_CHAN_DOI',
    name: 'Kẻ chán đời',
    faction: 'NEUTRAL',
    factionLabel: 'Phe Thứ Ba & Khác',
    description: 'Thắng nếu bị treo',
    iconName: 'Frown',
    defaultCount: 0
  },
  {
    key: 'KE_BI_SOI_NGUYEN',
    name: 'Kẻ bị sói nguyền',
    faction: 'NEUTRAL',
    factionLabel: 'Phe Thứ Ba & Khác',
    description: 'Hóa sói nếu bị cắn',
    iconName: 'Skull',
    defaultCount: 0
  }
];

export const PRESET_CONFIGS = [
  {
    name: 'Cấu hình Gợi ý 6 người',
    config: { DAN_LANG: 2, TIEN_TRI: 1, BAO_VE: 1, MA_SOI: 2 }
  },
  {
    name: 'Cấu hình Gợi ý 8 người',
    config: { DAN_LANG: 3, TIEN_TRI: 1, BAO_VE: 1, PHU_THUY: 1, MA_SOI: 2 }
  },
  {
    name: 'Cấu hình Gợi ý 10 người',
    config: { DAN_LANG: 4, TIEN_TRI: 1, BAO_VE: 1, PHU_THUY: 1, THO_SAN: 1, MA_SOI: 2 }
  }
];

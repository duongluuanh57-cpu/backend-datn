import mongoose, { Document, Schema } from 'mongoose';
import { multiTenancyPlugin } from '../utils/multiTenancyPlugin.ts';

export interface ISectionConfig {
  id: string;
  enabled: boolean;
  order: number;
}

export interface IProductCardConfig {
  imageAspect: 'square' | 'portrait' | 'landscape';
  imagePadding: number;
  cardRadius: number;
  tagBgColor: string;
  tagTextColor: string;
  discountBadgeBg: string;
  discountBadgeText: string;
  brandFontSize: number;
  nameFontSize: number;
  priceFontSize: number;
  textAlign: 'center' | 'left';
  elementOrder: string[];
  showKeywords: boolean;
  showSizes: boolean;
  showRating: boolean;
}

export interface INavLink {
  label: string;
  href: string;
  order: number;
  enabled: boolean;
}

export interface INavbarConfig {
  logo: {
    image: string;
    text: string;
    width: number;
    height: number;
  };
  links: INavLink[];
  style: {
    background: string;
    textColor: string;
    accentColor: string;
  };
}

export interface IGalleryImage {
  url: string;
  aspect: string;
  title: string;
  quote: string;
}

export interface IFooterLinkItem {
  label: string;
  href: string;
  order: number;
  enabled: boolean;
}

export interface IFooterColumn {
  title: string;
  links: IFooterLinkItem[];
}

export interface IFooterSocialLink {
  platform: string;
  url: string;
  enabled: boolean;
}

export interface IFooterConfig {
  style: {
    background: string;
    textColor: string;
    headingColor: string;
    borderColor: string;
  };
  brand: {
    title: string;
    description: string;
    logo: string;
    enabled: boolean;
  };
  columns: IFooterColumn[];
  socialLinks: IFooterSocialLink[];
  newsletter: {
    enabled: boolean;
    title: string;
    description: string;
    email: string;
  };
  copyright: {
    text: string;
    enabled: boolean;
    showPaymentIcons: boolean;
  };
  layout: {
    columnOrder: string[];
    showBrand: boolean;
    showNewsletter: boolean;
    showSocialLinks: boolean;
    showPaymentIcons: boolean;
  };
}

export interface IHomepageConfig extends Document {
  tenantId: string;
  sections: ISectionConfig[];
  bannerImages: string[];
  bannerTitleVi: string;
  bannerSubtitleVi: string;
  bannerLabelVi: string;
  bannerTitleEn: string;
  bannerSubtitleEn: string;
  bannerLabelEn: string;
  galleryVi: IGalleryImage[];
  galleryEn: IGalleryImage[];
  productCardConfig: IProductCardConfig;
  blogCardConfig: Record<string, any>;
  productSessionLayout: Record<string, any>;
  navbar: INavbarConfig;
  footer: IFooterConfig;
  updatedAt: Date;
}

const SectionConfigSchema = new Schema<ISectionConfig>(
  {
    id: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    order: { type: Number, required: true }
  },
  { _id: false }
);

const GalleryImageSchema = new Schema<IGalleryImage>(
  {
    url: { type: String, default: '' },
    aspect: { type: String, default: 'aspect-[3/4]' },
    title: { type: String, default: '' },
    quote: { type: String, default: '' }
  },
  { _id: false }
);

const DEFAULT_SECTIONS: ISectionConfig[] = [
  { id: 'banner', enabled: true, order: 0 },
  { id: 'brandsMarquee', enabled: true, order: 1 },
  { id: 'saleProducts', enabled: true, order: 2 },
  { id: 'newProducts', enabled: true, order: 3 },
  { id: 'trendingProducts', enabled: true, order: 4 },
  { id: 'brandUsp', enabled: true, order: 5 },
  { id: 'luxuryGallery', enabled: true, order: 6 },
  { id: 'blogPosts', enabled: true, order: 7 }
];

const ProductCardConfigSchema = new Schema<IProductCardConfig>(
  {
    imageAspect: { type: String, enum: ['square', 'portrait', 'landscape'], default: 'square' },
    imagePadding: { type: Number, default: 40 },
    cardRadius: { type: Number, default: 16 },
    tagBgColor: { type: String, default: '#FFFFFF' },
    tagTextColor: { type: String, default: '#7A5C5C' },
    discountBadgeBg: { type: String, default: '#D4A5A5' },
    discountBadgeText: { type: String, default: '#FFFFFF' },
    brandFontSize: { type: Number, default: 11 },
    nameFontSize: { type: Number, default: 14 },
    priceFontSize: { type: Number, default: 16 },
    textAlign: { type: String, enum: ['center', 'left'], default: 'center' },
    elementOrder: {
      type: [String],
      default: ['keywords', 'brand', 'name', 'sizes', 'rating', 'price']
    },
    showKeywords: { type: Boolean, default: true },
    showSizes: { type: Boolean, default: true },
    showRating: { type: Boolean, default: true }
  },
  { _id: false }
);

const HomepageConfigSchema = new Schema<IHomepageConfig>(
  {
    sections: {
      type: [SectionConfigSchema],
      default: DEFAULT_SECTIONS
    },
    bannerImages: {
      type: [String],
      default: [
        '/images/banner-1.webp',
        '/images/banner-2.webp',
        '/images/banner-3.webp',
        '/images/banner-4.webp'
      ]
    },
    bannerTitleVi: { type: String, default: 'Độc bản hương thơm Niche' },
    bannerSubtitleVi: {
      type: String,
      default:
        'Khám phá tinh hoa mùi hương quý tộc mang đậm phong vị cá nhân từ những nhà điều chế hàng đầu thế giới.'
    },
    bannerLabelVi: { type: String, default: 'BST NƯỚC HOA CAO CẤP' },
    bannerTitleEn: { type: String, default: 'Bespoke Niche Perfumery' },
    bannerSubtitleEn: {
      type: String,
      default:
        'Explore the elite essence of royal perfumery, crafted for individual distinction by master scent designers.'
    },
    bannerLabelEn: { type: String, default: 'PREMIUM FRAGRANCE HOUSE' },
    galleryVi: { type: [GalleryImageSchema], default: [] },
    galleryEn: { type: [GalleryImageSchema], default: [] },
    productCardConfig: { type: ProductCardConfigSchema, default: () => ({}) },
    blogCardConfig: { type: Schema.Types.Mixed, default: {} },
    productSessionLayout: { type: Schema.Types.Mixed, default: {} },
    navbar: {
      type: new Schema({
        logo: {
          type: new Schema({
            image: { type: String, default: 'https://i.ibb.co/TxzQXcMT/original.png' },
            text: { type: String, default: "L'essence" },
            width: { type: Number, default: 120 },
            height: { type: Number, default: 35 }
          }, { _id: false }),
          default: () => ({})
        },
        links: {
          type: [new Schema({
            label: { type: String, required: true },
            href: { type: String, required: true },
            order: { type: Number, default: 0 },
            enabled: { type: Boolean, default: true }
          }, { _id: false })],
          default: [
            { label: 'Trang chủ', href: '/', order: 0, enabled: true },
            { label: 'Cửa hàng', href: '/collections', order: 1, enabled: true },
            { label: 'Bộ sưu tập', href: '/bo-suu-tap', order: 2, enabled: true },
            { label: 'Bài viết', href: '/blog', order: 3, enabled: true },
            { label: 'Hỗ trợ', href: '/tro-giup', order: 4, enabled: true },
            { label: 'Về chúng tôi', href: '/about', order: 5, enabled: true }
          ]
        },
        style: {
          type: new Schema({
            background: { type: String, default: '#FFF5F5' },
            textColor: { type: String, default: '#7A5C5C' },
            accentColor: { type: String, default: '#C08497' },
            iconSize: { type: Number, default: 26 }
          }, { _id: false }),
          default: () => ({})
        },
        layout: {
          type: new Schema({
            left: { type: [String], default: ['logo'] },
            center: { type: [String], default: ['link-0', 'link-1', 'link-2', 'link-3', 'link-4', 'link-5'] },
            right: { type: [String], default: ['search', 'cart', 'user'] }
          }, { _id: false }),
          default: () => ({})
        }
      },       { _id: false }),
      default: () => ({})
    },
    footer: {
      type: new Schema({
        style: {
          type: new Schema({
            background: { type: String, default: 'rgba(255, 255, 255, 0.02)' },
            textColor: { type: String, default: '#5D4040' },
            headingColor: { type: String, default: '#7A5C5C' },
            borderColor: { type: String, default: 'rgba(122, 92, 92, 0.08)' },
          }, { _id: false }),
          default: () => ({})
        },
        brand: {
          type: new Schema({
            title: { type: String, default: "L'essence" },
            description: { type: String, default: 'Hành trình đánh thức giác quan thông qua những nốt hương haute couture. Mỗi sản phẩm là một tác phẩm nghệ thuật, mang tâm hồn và sự lãng mạn của nước Pháp.' },
            logo: { type: String, default: '' },
            enabled: { type: Boolean, default: true },
          }, { _id: false }),
          default: () => ({})
        },
        columns: {
          type: [new Schema({
            title: { type: String, required: true },
            links: {
              type: [new Schema({
                label: { type: String, required: true },
                href: { type: String, required: true },
                order: { type: Number, default: 0 },
                enabled: { type: Boolean, default: true },
              }, { _id: false })],
              default: []
            },
          }, { _id: false })],
          default: [
            {
              title: 'Khám Phá',
              links: [
                { label: 'Bộ Sưu Tập', href: '/shop', order: 0, enabled: true },
                { label: 'Sản Phẩm Mới', href: '/new-arrivals', order: 1, enabled: true },
                { label: 'Câu Chuyện Thương Hiệu', href: '/about', order: 2, enabled: true },
                { label: 'Liên Hệ', href: '/contact', order: 3, enabled: true },
                { label: 'Cửa Hàng', href: '/stores', order: 4, enabled: true },
              ]
            },
            {
              title: 'Về chúng tôi',
              links: [
                { label: 'Giới thiệu', href: '/about', order: 0, enabled: true },
                { label: 'Câu chuyện thương hiệu', href: '/about#story', order: 1, enabled: true },
                { label: 'Tuyển dụng', href: '/careers', order: 2, enabled: true },
                { label: 'Liên hệ', href: '/contact', order: 3, enabled: true },
              ]
            },
          ]
        },
        socialLinks: {
          type: [new Schema({
            platform: { type: String, required: true },
            url: { type: String, default: '' },
            enabled: { type: Boolean, default: true },
          }, { _id: false })],
          default: [
            { platform: 'instagram', url: '#', enabled: true },
            { platform: 'facebook', url: '#', enabled: true },
            { platform: 'twitter', url: '#', enabled: true },
          ]
        },
        newsletter: {
          type: new Schema({
            enabled: { type: Boolean, default: true },
            title: { type: String, default: 'Kết Nối' },
            description: { type: String, default: 'Đăng ký nhận những đặc quyền riêng biệt và thông tin mới nhất từ L\'essence.' },
            email: { type: String, default: 'concierge@lessence.com' },
          }, { _id: false }),
          default: () => ({})
        },
        copyright: {
          type: new Schema({
            text: { type: String, default: 'L\'essence. Trang web là sản phẩm của trường Cao đẳng FPT Polytechnic không có mục đích thương mại.' },
            enabled: { type: Boolean, default: true },
            showPaymentIcons: { type: Boolean, default: false },
          }, { _id: false }),
          default: () => ({})
        },
        layout: {
          type: new Schema({
            columnOrder: { type: [String], default: ['brand', 'col-0', 'col-1', 'newsletter'] },
            showBrand: { type: Boolean, default: true },
            showNewsletter: { type: Boolean, default: true },
            showSocialLinks: { type: Boolean, default: true },
            showPaymentIcons: { type: Boolean, default: false },
          }, { _id: false }),
          default: () => ({})
        }
      }, { _id: false }),
      default: () => ({})
    }
  },
  {
    timestamps: true,
    minimize: false,
    collection: 'homepage_configs'
  }
);

HomepageConfigSchema.plugin(multiTenancyPlugin);

export const HomepageConfig =
  mongoose.models.HomepageConfig ||
  mongoose.model<IHomepageConfig>('HomepageConfig', HomepageConfigSchema);

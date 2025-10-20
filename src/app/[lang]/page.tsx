import { Suspense } from 'react';
import dynamic from 'next/dynamic';

// 动态导入组件，使用相对路径避免别名解析问题
const HomeContent = dynamic(
  () => import('../../components/HomeContent'),
  { ssr: true, loading: () => <div>Loading...</div> }
);

// 生成静态参数，支持静态导出
export function generateStaticParams() {
  return [
    { lang: 'en' },
    { lang: 'zh' },
  ];
}

// 使用正确的异步参数处理方式，符合Next.js 15要求
export default async function Home({ params }: {
  params: Promise<{ lang: string }>;
}) {
  // 正确等待params解析
  const resolvedParams = await params;
  const { lang } = resolvedParams;
  
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent lang={lang} />
    </Suspense>
  );
}


import { Suspense } from 'react';
import dynamic from 'next/dynamic';

// 动态导入组件，使用相对路径避免别名解析问题
const HomeContent = dynamic(
  () => import('../../components/HomeContent'),
  { ssr: true, loading: () => <div>Loading...</div> }
);

interface HomeProps {
  params: {
    lang: string;
  };
}

// 生成静态参数，支持静态导出
export function generateStaticParams() {
  return [
    { lang: 'en' },
    { lang: 'zh' },
  ];
}

export default function Home({ params }: HomeProps) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent lang={params.lang} />
    </Suspense>
  );
}


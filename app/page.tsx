import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NAV } from "@/lib/nav";

export default function Home() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          풀필먼트 검수-포장 판단 시스템
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          화면 3개 · 명세는 docs 저장소가 정본
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="group">
            <Card className="h-full transition-colors group-hover:border-foreground/20">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  {item.label}
                  <span className="text-xs font-normal text-muted-foreground">
                    {item.owner}
                  </span>
                </CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

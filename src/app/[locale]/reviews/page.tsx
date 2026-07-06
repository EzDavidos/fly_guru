import type { Metadata } from "next";
import { Container, Section, SectionHeading, Button } from "@/components/ui";
import { ReviewCard } from "@/components/ReviewCard";
import { reviews } from "@/content/reviews";

export const metadata: Metadata = { title: "Отзывы" };
export const dynamic = "force-static"; // статичная страница, форсим SSG

export default function ReviewsPage() {
  return (
    <Section className="pt-10 sm:pt-14">
      <Container>
        <SectionHeading
          eyebrow="Отзывы"
          title="Что говорят наши ученики"
          subtitle="Реальные истории тех, кто уже летает с FlyGuru."
        />
        {/* TODO: заменить рыбу на реальные отзывы (см. src/content/reviews.ts) */}
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r, i) => (
            <ReviewCard key={i} review={r} />
          ))}
        </div>

        <div className="mt-12 rounded-3xl border border-line bg-surface-2 p-8 text-center">
          <h2 className="text-xl font-bold">Уже катались с нами?</h2>
          <p className="mt-2 text-muted">Будем рады вашему отзыву.</p>
          <div className="mt-5 flex justify-center">
            <Button href="/contacts">Оставить отзыв</Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}

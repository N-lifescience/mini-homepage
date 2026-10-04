import type { Metadata } from "next";
import Showroom from "@/components/showroom/Showroom";
import "./showroom.css";

export const metadata: Metadata = {
  title: "N의 생명과학 쇼룸",
  description: "N의 상상을 더한 N가지 생명과학 이야기"
};

export default function ShowroomPage() {
  return <Showroom />;
}

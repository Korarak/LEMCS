import { redirect } from "next/navigation";

export default function Home() {
  // redirect ไปหน้าที่สำคัญโดยตรง (กรณีนี้คือ login)
  redirect("/login");
}

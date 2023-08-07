import { Entity } from 'typeorm';

@Entity()
export class OrderEntity {
  id?: string;
  name: string;
  surname: string;
  email: string;
  phone: string;
  age: string;
  course: string;
  course_type: string;
  course_format: string;
  start_date: Date;
  end_date: Date;
  status: string;
  manager: string;
  group: string;
}

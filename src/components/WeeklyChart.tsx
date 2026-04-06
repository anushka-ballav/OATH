import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CardShell } from './CardShell';

interface WeeklyChartProps {
  title: string;
  data: Array<{ day: string; value: number }>;
  color: string;
}

export const WeeklyChart = ({ title, data, color }: WeeklyChartProps) => (
  <CardShell>
    <div className="mb-4 flex items-center justify-between">
      <div>
        <p className="text-sm uppercase tracking-[0.24em] text-black">{title}</p>
        <h3 className="font-display text-xl">Trend</h3>
      </div>
    </div>

    <div className="h-52 sm:h-60">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
          <XAxis dataKey="day" stroke="currentColor" tick={{ fill: 'currentColor', fontSize: 12 }} />
          <YAxis stroke="currentColor" tick={{ fill: 'currentColor', fontSize: 12 }} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={3} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </CardShell>
);

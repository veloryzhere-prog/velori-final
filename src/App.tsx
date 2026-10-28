import AppRouter from "./app/App";

export interface DeviceConfig {
  id: string;
  label: string;
  icon: string;
  aspect: string;
  width: number;
  height: number;
}

export default function App() {
  return <AppRouter />;
}

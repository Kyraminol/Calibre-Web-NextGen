import { Router, Route, Switch } from 'wouter';
import { useMe, useLogout } from './lib/queries';
import { Login } from './pages/Login';
import { Catalog } from './pages/Catalog';
import { BookDetail } from './pages/BookDetail';
import { TopBar } from './components/TopBar';
import { SpinnerCentered } from './components/Spinner';

export function App() {
  const { data: me, isLoading } = useMe();
  const logout = useLogout();

  if (isLoading) {
    return <SpinnerCentered size={40} />;
  }

  if (!me) {
    return <Login />;
  }

  return (
    <Router base="/app">
      <TopBar
        userName={me.name}
        onLogout={() => logout.mutate()}
      />
      <Switch>
        <Route path="/book/:id" component={BookDetail} />
        <Route path="/" component={Catalog} />
      </Switch>
    </Router>
  );
}

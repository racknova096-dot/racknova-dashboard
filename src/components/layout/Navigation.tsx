import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Package, Table, LayoutDashboard, Plus, Users, Activity } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

// Navigation component for inventory system
export function Navigation() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-card border-b border-border p-4">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Package className="h-6 w-6 text-primary" />
          <h2 className="text-lg font-semibold">Sistema de Inventario</h2>
        </div>
        
        <div className="flex gap-2 items-center">
          <div className="flex gap-2">
            <Link to="/">
              <Button 
                variant={isActive('/') ? 'default' : 'outline'}
                size="sm"
                className="flex items-center gap-2"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            <Link to="/add-product">
              <Button 
                variant={isActive('/add-product') ? 'default' : 'outline'}
                size="sm"
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Agregar
              </Button>
            </Link>
            <Link to="/products">
              <Button 
                variant={isActive('/products') ? 'default' : 'outline'}
                size="sm"
                className="flex items-center gap-2"
              >
                <Table className="h-4 w-4" />
                Productos
              </Button>
            </Link>
            <Link to="/users">
              <Button 
                variant={isActive('/users') ? 'default' : 'outline'}
                size="sm"
                className="flex items-center gap-2"
              >
                <Users className="h-4 w-4" />
                Usuarios
              </Button>
            </Link>
            <Link to="/tracking">
              <Button 
                variant={isActive('/tracking') ? 'default' : 'outline'}
                size="sm"
                className="flex items-center gap-2"
              >
                <Activity className="h-4 w-4" />
                Trackeo
              </Button>
            </Link>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
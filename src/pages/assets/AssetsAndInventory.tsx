import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Laptop, Plus, ShieldAlert, Cpu, HardDrive } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AssetsAndInventory() {
  const { user, account } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form State
  const [assetTag, setAssetTag] = useState(`ZJ-AST-${format(new Date(), "yyyy")}-001`);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"Laptop" | "Desktop" | "Server" | "Monitor" | "Software License" | "Other">("Laptop");
  const [serialNumber, setSerialNumber] = useState("");
  const [purchaseCost, setPurchaseCost] = useState<number>(0);
  const [location, setLocation] = useState("Main Office");

  const activeAccountId = account?.id;

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["it-assets", activeAccountId],
    queryFn: async () => {
      let query = supabase.from("it_assets").select("*, employees(name)").order("created_at", { ascending: false });
      if (activeAccountId) query = query.eq("account_id", activeAccountId);
      const { data, error } = await query;
      if (error) {
        console.warn("Could not fetch IT assets:", error.message);
        return [];
      }
      return data || [];
    }
  });

  const createAssetMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        asset_tag: assetTag,
        name,
        category,
        serial_number: serialNumber,
        purchase_cost: purchaseCost,
        current_value: purchaseCost,
        location,
        status: "in_use",
        account_id: activeAccountId || null
      };
      const { error } = await supabase.from("it_assets").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("IT Asset registered successfully");
      queryClient.invalidateQueries({ queryKey: ["it-assets"] });
      setIsCreateOpen(false);
      setName("");
      setSerialNumber("");
      setPurchaseCost(0);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to register asset");
    }
  });

  const totalAssetValue = assets.reduce((s: number, a: any) => s + Number(a.purchase_cost || 0), 0);
  const currentAssetValue = assets.reduce((s: number, a: any) => s + Number(a.current_value || a.purchase_cost || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Laptop className="h-6 w-6 text-primary" />
            IT Assets & Equipment Management
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Laptops, developer workstations, monitors, cloud licenses, and straight-line depreciation
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="font-bold text-xs">
              <Plus className="h-4 w-4 mr-1.5" />
              Register IT Asset
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[460px]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Register Hardware / License</DialogTitle>
            </DialogHeader>
            <div className="space-y-3.5 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Asset Tag</Label>
                  <Input value={assetTag} onChange={(e) => setAssetTag(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Category</Label>
                  <Select value={category} onValueChange={(val: any) => setCategory(val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Laptop">Laptop</SelectItem>
                      <SelectItem value="Desktop">Desktop Workstation</SelectItem>
                      <SelectItem value="Monitor">Monitor</SelectItem>
                      <SelectItem value="Server">Server / Networking</SelectItem>
                      <SelectItem value="Software License">Software License</SelectItem>
                      <SelectItem value="Other">Other Equipment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Item Name & Model</Label>
                <Input placeholder="e.g. MacBook Pro M3 Max 36GB" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Serial # / Key</Label>
                  <Input placeholder="Hardware Serial Number" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Purchase Price (₹)</Label>
                  <Input
                    type="number"
                    value={purchaseCost || ""}
                    onChange={(e) => setPurchaseCost(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Location / Office</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={() => createAssetMutation.mutate()} disabled={!name || purchaseCost <= 0}>
                Register Asset
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Asset KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm border-t-4 border-t-blue-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Assets Value (Original)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black text-blue-600">
              ₹{totalAssetValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-t-4 border-t-emerald-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current Book Value (Net of Dep.)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black text-emerald-600">
              ₹{currentAssetValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-t-4 border-t-purple-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Hardware Count</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black text-purple-700">{assets.length} Assets</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900">
              <TableRow>
                <TableHead className="w-28 text-[10px] uppercase font-bold">Asset Tag</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Hardware / License Name</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Category</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Assigned User</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-bold">Original Cost</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-bold">Book Value</TableHead>
                <TableHead className="text-center text-[10px] uppercase font-bold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((ast: any) => (
                <TableRow key={ast.id} className="hover:bg-slate-50">
                  <TableCell className="font-mono text-xs font-bold text-slate-900">{ast.asset_tag}</TableCell>
                  <TableCell>
                    <span className="font-semibold text-xs text-slate-900">{ast.name}</span>
                    {ast.serial_number && <p className="text-[10px] text-muted-foreground font-mono">S/N: {ast.serial_number}</p>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] uppercase font-bold">
                      {ast.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-slate-700 font-medium">
                    {ast.employees?.name || "Available in Pool"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-semibold text-slate-700">
                    ₹{Number(ast.purchase_cost || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-bold text-slate-900">
                    ₹{Number(ast.current_value || ast.purchase_cost || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className="bg-emerald-600 text-white text-[10px] uppercase">
                      {ast.status || "In Use"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// //app/binder/[binderId]/BinderViewClient.tsx
// "use client"

// import BinderView from "@/components/binder/BinderView"
// import { useAuth } from "@/contexts/AuthContext"
// import { useEffect, useState } from "react"

// export default function BinderViewClient({ initialBinder }: { initialBinder: any }) {
//   const { user, loading } = useAuth()
//   const [editable, setEditable] = useState(false)

//   useEffect(() => {
//     if (!loading && user && initialBinder?.userId) {
//       setEditable(user.id === initialBinder.userId)
//     } else {
//       setEditable(false)
//     }
//   }, [user, loading, initialBinder])

//   // Optionally, show a loading state while auth is loading
//   if (loading) {
//     return <div className="text-center py-12">Loading authentication...</div>
//   }

//   return <BinderView 
//     initialBinder={initialBinder} 
//     user={user} 
//     editable={editable} 
//     binderId={initialBinder._id}
//   />
// }
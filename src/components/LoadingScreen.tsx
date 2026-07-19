import { Html, useProgress } from '@react-three/drei'
import { Box, CircularProgress, Typography } from '@mui/material'

export function LoadingScreen() {
  const { progress } = useProgress()

  return (
    <Html center>
      <Box sx={{ textAlign: 'center', color: 'white' }}>
        <CircularProgress 
          variant="determinate" 
          value={progress} 
          size={60} 
          thickness={4}
          sx={{ color: 'primary.main' }}
        />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading {Math.round(progress)}%
        </Typography>
      </Box>
    </Html>
  )
}